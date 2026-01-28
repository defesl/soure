# Friends System — Manual Testing Checklist

Use this checklist to verify the Friends feature (request flow, accept/reject, list, remove).

## Prerequisites

- Server running (`npm run dev` or `node server/server.js`)
- Database migrated: `npx prisma migrate deploy` (or `npx prisma migrate dev` for the friends migration)
- Two browser sessions (or incognito + normal) for users A and B

---

## 1. Register two users: A and B

- [ ] Open app, go to **Register**
- [ ] Register user **A** (e.g. `usera` / password)
- [ ] Log out (Settings → Logout) or use second session
- [ ] Register user **B** (e.g. `userb` / password)
- [ ] Ensure both can log in and see the main menu

---

## 2. A sends friend request to B

- [ ] Log in as **A**
- [ ] Click **Friends** (main menu) → Friends page loads
- [ ] In "Add Friend", enter **B**’s username (e.g. `userb`)
- [ ] Click **Send Request**
- [ ] See success message (e.g. "Request sent.")
- [ ] "Outgoing Requests" shows one row: B, status Pending, **Cancel** button

---

## 3. B sees incoming request and accepts

- [ ] Log in as **B** (other session/incognito)
- [ ] Open **Friends** page
- [ ] "Incoming Requests" shows one row: A with **Accept** and **Reject**
- [ ] Click **Accept**
- [ ] Incoming request disappears
- [ ] "Friends List" shows **A** with "Friends since …" and **Remove**

---

## 4. Both see each other in Friends List

- [ ] As **B**: Friends List shows **A**
- [ ] As **A**: Refresh Friends page (or re-open); Friends List shows **B**
- [ ] Both see the other with "Friends since …" and **Remove**

---

## 5. B removes A → both lists update

- [ ] As **B**, in Friends List click **Remove** next to A
- [ ] A disappears from B’s Friends List
- [ ] As **A**, refresh Friends page; B disappears from A’s Friends List

---

## 6. A sends again; B rejects

- [ ] As **A**: Send request to B again (Add Friend → B → Send Request)
- [ ] As **B**: Open Friends → Incoming Requests shows A
- [ ] Click **Reject**
- [ ] Incoming request disappears; A does not appear in B’s Friends List
- [ ] As **A**: Outgoing request disappears (rejected by receiver)

---

## 7. Outgoing cancel works

- [ ] As **A**: Send request to B again
- [ ] As **A**: In "Outgoing Requests" click **Cancel**
- [ ] Outgoing request disappears
- [ ] As **B**: No new incoming request (or previous one already rejected)

---

## 8. Duplicate requests prevented

- [ ] As **A**: Send request to B
- [ ] As **A**: Try again to send request to B → see error (e.g. "Request already sent")
- [ ] As **B**: Do not accept yet; as **A** try sending again → still blocked or clear message

---

## 9. Self-add prevented

- [ ] As **A**: In Add Friend enter **A**’s own username
- [ ] Click Send Request → see error (e.g. "You cannot send a request to yourself")

---

## 10. Not logged in: endpoints blocked and UI shows login message

- [ ] Log out (or use incognito with no login)
- [ ] Open **Friends** page directly (e.g. `/friends`)
- [ ] See message "Please log in to use Friends" and **Log in** link
- [ ] (Optional) Try `POST /api/friends/request` without session → 401 and `{ ok: false, error: "Please log in" }`

---

## 11. User not found

- [ ] Log in, go to Friends
- [ ] Add Friend with a username that does not exist (e.g. `nonexistentuser123`)
- [ ] Send Request → see error (e.g. "User not found")

---

## 12. Already friends

- [ ] A and B are friends (A sent, B accepted)
- [ ] As **A**: Try to send request to B again → error (e.g. "Already friends")
- [ ] As **B**: Try to send request to A → same error

---

## Quick summary

| Step | Action                    | Expected result                          |
|------|---------------------------|------------------------------------------|
| 1    | Register A, B             | Both can log in                          |
| 2    | A sends request to B      | Outgoing shows Pending; B can accept     |
| 3    | B accepts                 | Both see each other in Friends List      |
| 4    | Both open Friends         | Each sees the other in list              |
| 5    | B removes A               | Both lists update (no longer friends)    |
| 6    | A sends again; B rejects  | Request gone; not friends                |
| 7    | A sends; A cancels        | Outgoing request removed                 |
| 8    | Duplicate send            | Error: already sent / pending            |
| 9    | Send to self              | Error: cannot add yourself               |
| 10   | Open /friends logged out  | "Please log in" + link                   |
| 11   | Send to nonexistent user  | Error: user not found                    |
| 12   | Send when already friends | Error: already friends                   |
