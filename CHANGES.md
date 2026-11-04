# What's new

What changed for you in each version of Todo list, newest first. The desk shows the parts that are new when it
offers you an update.

## 0.4.1

- Changed: Start a session sits with Create issue and Link issue, and once a todo has a session it reads Resume
  session and takes you back to it. It only shows when Sessions is on your desk.
- Fixed: Start a session and picking a todo for a session work for todos with spaces or punctuation in their name
  (with desk 0.6.36).

## 0.4.0

- New: Start a session on a todo opens Sessions (which comes with the desk) with the todo as the session's goal, and
  the todo keeps a link to it: Open session takes you back. In Sessions, Link a todo brings you here to pick the todo
  a session is about.

## 0.3.1

- Fixed: an open todo's buttons (Mark done, Ask AI and the rest) no longer sit right under Add a step. They have a
  line of their own above them, and the Add a step box is shorter, so it's clear which buttons belong to the
  checklist and which to the todo.

## 0.3.0

- New: each todo is folded to a single line, with what it is, who asked, its dates and flags, and how many checklist
  steps, issues and AI reports it has. Click it to open the whole todo; click it again to fold it. A long list now
  fits on one screen.

## 0.2.0

- New: Add todo is now a button at the top of the page that opens the form in a pop-up, so your list gets the
  whole page. Cancel or Esc closes it and keeps what you typed for next time.

## 0.1.1

- Fixed: the text boxes, date picker and drop-downs now look like the rest of the desk, with rounded corners,
  the desk's colours in light and dark, and a clear outline on the one you're typing in.

## 0.1.0

- Keeps your todo list on the desk: what, who asked, a description and a delivery date, soonest first, with overdue
  ones flagged. Done ones fold away and are removed after the days you set.
- Each todo can have a checklist of steps to tick off.
- Ask AI investigates a todo or gives its opinion, reading one of your repos with a read-only agent, or the todo's
  text alone. With a public repo it can search the web too. Its report stays with the todo.
- Create issue drafts a GitHub issue from a todo or one of its steps, in one of your repos, and creates it once you
  confirm. Link issue links one that's already there. A todo can have several issues, and each step one. Each weekday
  morning it checks whether they're still open.
