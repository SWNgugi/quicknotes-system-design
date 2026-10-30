# QuickNotes Architecture

This document describes how QuickNotes can be built to serve 1 million users. It builds on the REST API in `api-design.md` and the database in `data-model.md`.

## 1. Requirements

### Functional requirements

- Users can register and log in.
- Users can create, list, view, edit and delete their own notes.
- Users can tag notes and filter their notes by tag.
- Notes are listed page by page, newest first.
- A user can only see and change their own notes.

### Non-functional requirements

- **Scale:** support 1,000,000 registered users, and handle a peak that is 5 times the average load.
- **Availability:** 99.9% uptime (about 8.8 hours of downtime a year at most), with no single point of failure.
- **Performance:** `GET /notes` responds in under 300 ms for 95% of requests.
- **Durability:** once a note is saved, it is never lost (replication plus daily backups).
- **Consistency:** a user sees their own new or edited note straight away.
- **Security:** HTTPS everywhere, hashed passwords, token-based login and an ownership check on every request.

## 2. Load estimate

### Assumptions

- 1,000,000 registered users, and 20% are active each day, so **200,000 daily active users**.
- Each active user loads their notes list 30 times a day (reads).
- Each active user makes 5 writes a day: 3 new notes, 1 edit and 1 delete.
- An average stored note takes 2 KB (about 1 KB of text, plus ids, timestamps, tag links and index overhead).
- One day has 86,400 seconds and one year has 365 days. Peak load is 5 times the average.
- Units are decimal (1 GB = 1,000,000 KB). Backups are not counted.

### Results

| Measure           | Working                                  | Average             | Peak (5x)            |
| ----------------- | ---------------------------------------- | ------------------- | -------------------- |
| Reads per second  | 200,000 x 30 = 6,000,000 a day, / 86,400 | about 69 per second | about 347 per second |
| Writes per second | 200,000 x 5 = 1,000,000 a day, / 86,400  | about 12 per second | about 58 per second  |

**Storage per year:**

- New notes per day: 200,000 x 3 = 600,000.
- Storage per day: 600,000 x 2 KB = 1,200,000 KB = 1.2 GB.
- Storage per year: 1.2 GB x 365 = **about 438 GB** (roughly 0.44 TB). With one read replica holding a full copy, the database disks need about 0.9 TB a year.

**What this means:** reads outnumber writes about 6 to 1, so the system is **read-heavy**. A single primary database can easily handle 58 writes per second at peak, so the design focuses on making reads cheap with a cache and a read replica. Storage is small, so there is no need to split the database across many servers at this scale.

## 3. Architecture diagram

```
   +----------+        +---------+
   |  Client  |------->|   DNS   |   finds the server's address
   +----+-----+        +---------+
        |
        v
   +----------+
   |   CDN    |   serves static files; API calls pass through
   +----+-----+
        |
        v
+-------------------+
|   Load balancer   |   (a standby copy takes over if it fails)
+----+---------+----+
     |         |
     v         v
+----------+ +----------+
|   App    | |   App    |   ... more servers are added
| server 1 | | server 2 |   as traffic grows
+----+-----+ +-----+----+
     |             |
     +------+------+
            |
   every app server connects to each box below
            |
   +--------+-----------+-------------+
   |        |           |             |
   v        v           v             v
+-------+ +---------+ +---------+ +---------+
| Cache | | Primary | |  Read   | |  Queue  |
| Redis | |   DB    | | replica | +----+----+
+-------+ | (writes)| | (reads) |      |
          +----+----+ +---------+      v
               |            ^      +--------+
               +------------+      | Worker |
              copies every change  +--------+
```

## 4. What each component does

- **Client:** The browser or app the user sees, which sends requests to the API and shows the results.
- **DNS:** Turns the readable name (such as quicknotes.example) into the server address, so users never need to know an IP address and we can move servers without telling anyone.
- **CDN:** Serves the static files (HTML, CSS, JavaScript) from servers close to the user, so pages load quickly and that traffic never reaches our app servers.
- **Load balancer:** Spreads requests across the app servers and stops sending traffic to a server that has failed, so no single server is overloaded.
- **App servers:** Run the API logic (login, validation, notes) and are stateless, so we can add more of them when traffic grows.
- **Cache (Redis):** Keeps recently requested note lists in fast memory, so most reads never touch the database and respond in milliseconds.
- **Primary database:** The single place that accepts writes and holds the trusted copy of all users, notes and tags.
- **Read replica:** A live copy of the primary that answers read queries, which takes load off the primary and gives us a spare copy of the data.
- **Queue:** Holds slow, non-urgent jobs so the user does not have to wait for them.
- **Worker:** Takes jobs from the queue and runs them in the background, such as sending password-reset emails, updating weekly summary counts and building exports of a user's notes.

## 5. Request flows

### GET /notes (list notes)

1. The client sends `GET /api/v1/notes?page=1` with its token. DNS has already told it which address to use.
2. The CDN sees that this is an API call that must not be shared between users, so it passes it to the load balancer.
3. The load balancer picks a healthy app server.
4. The app server checks the token. If it is missing or expired, it returns 401.
5. The app server looks in the cache for this user's page (key `notes:user:42:page:1`).
6. **Cache hit:** it returns the stored JSON straight away (go to step 9).
7. **Cache miss:** it queries the read replica for that user's newest 10 notes and their tags.
8. It stores the result in the cache for 60 seconds.
9. It returns `200 OK` with the JSON, which travels back through the load balancer and CDN to the client.

### POST /notes (create a note)

1. The client sends `POST /api/v1/notes` with its token and a JSON body (title, body, tags).
2. The CDN passes it to the load balancer, which picks a healthy app server.
3. The app server checks the token (401 if invalid) and validates the data: a title is required and at most 100 characters (400 if not).
4. The app server writes the note, its tags and the note-tag links to the **primary database** in one transaction, so either everything is saved or nothing is.
5. The app server deletes this user's cached note lists, so the next read is fresh.
6. The app server puts a "note created" job on the queue. The worker will update the user's weekly summary count in the background, and nobody waits for it.
7. The app server returns `201 Created` with the new note and a `Location` header.
8. The worker takes the job from the queue and finishes it later. If it fails, the job stays in the queue and is retried.

## 6. Trade-offs

- **Cache speed vs fresh data:** Caching note lists makes reads far faster and protects the database, but a cached list can be up to 60 seconds old. We reduce the problem by deleting a user's cached pages whenever they write, but a longer cache time would save more database work at the cost of staler data.
- **Read replica vs consistency:** The replica copies changes from the primary with a small delay. A user could create a note and then read from a replica that has not caught up yet, so the note seems missing. To avoid this, for a few seconds after a user writes, we read that user's lists from the primary instead of the replica.
- **Queue and worker vs simplicity:** Background jobs keep requests fast and let us retry failures, but they add two more parts to run and monitor, and the results (such as emails) are not instant.
- **One primary database vs scale:** A single primary keeps the data consistent and the design simple, and it is more than enough for 58 writes per second. If writes grew a hundred times larger, we would need to split the data across several databases (sharding), which is much more complex.
- **Extra servers vs cost:** Two or more of everything costs more money than one, but it is what keeps the service running when a machine fails.

## 7. Avoiding single points of failure

| Component        | How a failure is survived                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DNS              | Use a provider with several name servers in different places.                                                                                               |
| CDN              | It is already spread over many locations worldwide.                                                                                                         |
| Load balancer    | Run a pair (or a managed load balancer across zones), so a standby takes over if one fails.                                                                 |
| App servers      | Run at least two, in different data centres (availability zones). They are stateless, so the load balancer simply sends traffic to the healthy ones.        |
| Cache            | Run Redis with a replica that takes over automatically. If the cache is down, app servers read from the database directly, which is slower but still works. |
| Primary database | The read replica is kept in a different zone and can be promoted to primary automatically if the primary fails. Daily backups protect against data loss.    |
| Queue            | Use a replicated or managed queue, so jobs are not lost if one machine fails.                                                                               |
| Worker           | Run two or more workers. Jobs are only removed from the queue after they finish, so a crashed worker's job is retried by another one.                       |
