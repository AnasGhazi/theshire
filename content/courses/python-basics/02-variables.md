---
id: python-basics-02
title: Variables and Strings
order: 2
---

A **variable** is a name that points to a value. You create one with `=`:

```python runnable
name = "Bilbo"
age = 111
print(name, "is", age, "years old")
```

Python figures out the type for you: `"Bilbo"` is a string (`str`), `111` is an integer (`int`), and `3.5` would be a decimal (`float`).

## f-strings

An **f-string** lets you drop variables straight into text. Put an `f` before the quotes and the variable in `{}`:

```python runnable
meal = "second breakfast"
hour = 9
print(f"{meal.title()} is at {hour} o'clock.")
```

Strings have handy methods like `.upper()`, `.lower()`, and `.title()`.

## Functions that return

A **function** is a reusable recipe. `def` defines one, and `return` hands a value back to whoever called it:

```python runnable
def shout(text):
    return text.upper() + "!"

print(shout("hello"))
```

## Exercise: Welcome sign

Write a function `greet(name)` that **returns** the string `Welcome to the Shire, <name>!`

For example, `greet("Sam")` returns `"Welcome to the Shire, Sam!"`.

```python exercise id=greet
def greet(name):
    # return the welcome message
    pass
```

```tests
- call: print(greet("Sam"))
  expect: "Welcome to the Shire, Sam!"
- call: print(greet("Rosie"))
  expect: "Welcome to the Shire, Rosie!"
- call: print(greet(""))
  expect: "Welcome to the Shire, !"
  hidden: true
```

```hint
Use an f-string: `return f"Welcome to the Shire, {name}!"`. Make sure you `return` it rather than `print` it.
```

```python solution
def greet(name):
    return f"Welcome to the Shire, {name}!"
```
