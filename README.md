<img src="https://raw.githubusercontent.com/House-elves/elf-desk/main/docs/brand/mark.svg" width="72" alt="House Elves logo: a checkmark that ends in an elf's hat">

# todo-list

A [House Elves](https://github.com/House-elves) elf for [Elf Desk](https://github.com/House-elves/elf-desk): **Todo
list** keeps your todo list on the desk, with who asked, due dates, a checklist, an AI opinion on any item, and GitHub
issues created from a todo or its steps in one click.

- **Add todo:** the button at the top opens a pop-up for what you have to do, and optionally who asked, a description
  (Markdown) and a delivery date. The create date is filled in for you. Edit, Mark done and Delete work straight away: nothing leaves your machine.
- **The list:** open todos, soonest delivery date first, then the ones with no date. Overdue ones are flagged. Each
  shows who asked, how old it is, and links to its GitHub issues. Done ones fold away under **Done**, and are removed
  after **Keep done items** days.
- **Checklist:** each todo can have steps to tick off. A step can have its own GitHub issue.
- **Ask AI:** pick **Investigate** or **Give an opinion**, and one of your repos for context (the one the AI suggests
  is picked first). A read-only agent reads a fresh clone of that repo and reports what the task involves, where it
  touches the code, the risks, a rough size and its opinion. Tick **Search the web too** and it also searches and
  reads the web, with the pages it used in its report; that's only for a public repo, and for a todo in your own
  words, because what it searches for goes to the web. With no repo picked, Claude answers from the todo's text. The
  report is kept with the todo.
- **Create issue:** on a todo or one of its steps. Claude drafts a title and body, mentioning who asked and the
  delivery date, and suggests one of your repos. Change any of it (only to repos in your list); nothing is posted
  until you click **Create issue** and confirm it in the desk. The issue's link is then kept on the todo or the step.
  A todo can have as many issues as you like; a step has one.
- **Link issue:** link an issue that's already there, in one of your repos, by its number. **Unlink** takes it off
  the todo and leaves it on GitHub as it is.
- **Each weekday morning** (you can turn it off) it checks whether the linked issues are still open, so a todo whose
  issue was closed says so, and updates the overdue flags. Its dashboard card says something like "7 open, 2 overdue",
  and asks for your attention when something is overdue or due today.

What it reads and writes:

- **Reads:** your todo list, on this machine. The repos in its settings on GitHub, as your gh account: a fresh clone
  of the one you pick when you click Ask AI (read by the runner's agent, in its sandbox, after a safety check, able
  only to read), and each morning the state of the issues linked to your open todos. With Search the web ticked, that
  agent also searches and reads the web. Claude reads a todo's text when you click Ask AI or Create issue.
- **Writes:** your todo list and the AI's reports, in `~/.config/todo-list/todos/`. A new GitHub issue in the repo you
  choose, as your gh account, only when you click Create issue and confirm it.

## Adding it

On Elf Desk, click **+**, find **Todo list**, and add it. Sign in with `gh auth login` if you haven't, then set your
GitHub account and **Repos** (like `owner/name, owner/other`) in its settings. It needs `gh` and `claude`.

## Running it by hand

    mkdir -p ~/.config/todo-list && printf 'GITHUB_LOGIN=your-login\nREPOS=owner/name\n' > ~/.config/todo-list/config
    jbang TodoList.java            # the morning check: prints what it would change, saves nothing
    jbang TodoList.java --save     # saved for its tab on Elf Desk
    echo '{"what":"Write the release notes","due":"2026-11-03"}' | jbang TodoList.java --action=save-todo
