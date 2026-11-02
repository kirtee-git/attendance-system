# Student Attendance Management System (Node.js + Amazon DynamoDB)

REST API + simple web UI for faculty to register students and add / view / update / delete / search attendance.

## Tech
Node.js, Express, AWS SDK v3 (DynamoDB Document Client), vanilla HTML/JS frontend.

## NoSQL Data Model
| Table | Partition Key | Sort Key | Notes |
|---|---|---|---|
| Students | studentId | - | name, email, department, year |
| Attendance | studentId | date (YYYY-MM-DD) | status, remarks, studentName |
| GSI `date-index` on Attendance | date | studentId | search all students by date |

Access patterns: a student's attendance history -> Query on PK; one student on a date -> GetItem; all students on a date -> Query on the GSI.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env` and fill in AWS keys (IAM user with DynamoDB access) and region.
3. `npm run create-tables`
4. `npm start`  -> http://localhost:3000

(Optional, no AWS account: `docker run -p 8000:8000 amazon/dynamodb-local`, then set `DYNAMODB_ENDPOINT=http://localhost:8000` in `.env`.)

## REST API
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/students | Register student |
| GET | /api/students, /api/students/:id | List / get student |
| PUT | /api/students/:id | Update student |
| DELETE | /api/students/:id | Delete student + their attendance |
| POST | /api/attendance | Mark attendance `{studentId, date, status, remarks}` |
| GET | /api/attendance?studentId=&date= | Search by student ID and/or date |
| GET | /api/attendance/:studentId/:date | Get one record |
| PUT | /api/attendance/:studentId/:date | Update status / remarks |
| DELETE | /api/attendance/:studentId/:date | Delete record |

Status values: `Present`, `Absent`, `Late`. Errors return 400 (validation), 404 (not found), 409 (duplicate), 500 (server).

## Deploy on Render (free)
1. Push this folder to a GitHub repo (`.env` is git-ignored).
2. render.com -> New -> Web Service -> connect the repo.
3. Build command: `npm install`  |  Start command: `npm start`
4. Add environment variables: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `STUDENTS_TABLE`, `ATTENDANCE_TABLE`.
5. Deploy and open the public URL. (Alternatives: AWS Elastic Beanstalk, EC2, Railway.)

## Quick test (curl)
```
curl -X POST localhost:3000/api/students -H "Content-Type: application/json" -d '{"studentId":"S101","name":"Asha Patil","department":"CSE","year":3}'
curl -X POST localhost:3000/api/attendance -H "Content-Type: application/json" -d '{"studentId":"S101","date":"2026-11-02","status":"Present"}'
curl "localhost:3000/api/attendance?studentId=S101"
curl "localhost:3000/api/attendance?date=2026-11-02"
```
