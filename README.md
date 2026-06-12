# Kappingarklárt v4.8.4

Bug-fix version from the uploaded v4.8.3 files.

Fixes in this version:

- Reworked the add-task click handling so it uses one delegated listener for all current and future add-task buttons
- The add-task button now uses its own dedicated data attribute and no longer conflicts with task cards or section data
- Adding a second, third, fourth, etc. task in the same section now targets the correct section every time
- The checklist re-renders immediately after a task is created, then opens the editor for the newly created task
- The task editor is reset before opening, making repeated task creation more reliable
- Task card clicks now ignore buttons, inputs and labels inside the card

Open `index.html` in your browser.
