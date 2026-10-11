---
id: python-basics-01
title: Hello, World
order: 1
---

Welcome to the Shire! Every programmer's journey starts with one line that makes the computer say something back.

In Python, that line uses `print()`:

```python runnable
print("Hello, World!")
```

Press **Run** and the output shows up in the terminal. Try changing the message and running it again.

## Comments

Lines starting with `#` are **comments**. Python skips them, so they're notes for humans:

```python runnable
# This line is ignored by Python
print("Comments are for people")  # this part is ignored too
```

You can print several things at once by separating them with commas. Python puts a space between them:

```python
print("Second", "breakfast")  # prints: Second breakfast
```

## Exercise: Greet the Shire

Write a program that prints exactly:

```
Hello, Shire!
```

```python exercise
# Write your code below

```

```tests
- call: ""
  expect: "Hello, Shire!"
```

```hint
Use `print()` with the text inside quotes. Capital letters and punctuation have to match exactly: `"Hello, Shire!"`.
```

```python solution
print("Hello, Shire!")
```
