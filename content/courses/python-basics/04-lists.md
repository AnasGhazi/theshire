---
id: python-basics-04
title: Lists
order: 4
---

A **list** holds several values in order, inside square brackets:

```python runnable
meals = ["breakfast", "second breakfast", "elevenses", "luncheon"]
print(meals[0])     # first item
print(meals[-1])    # last item
print(len(meals))   # how many
```

Lists can grow with `.append()`:

```python runnable
pantry = ["bread"]
pantry.append("cheese")
pantry.append("mushrooms")
print(pantry)
```

## Looping over a list

`for` works directly on lists, and `if` lets you choose what to do with each item:

```python runnable
words = ["pipe", "weed", "ale", "mushrooms"]
for word in words:
    if len(word) > 3:
        print(word, "is a long word")
```

## Exercise: Longest word

Write `longest_word(words)` that returns the longest string in the list. If several are tied, return the **first** one.

```python exercise id=longest-word
def longest_word(words):
    # your code here
    pass
```

```tests
- call: print(longest_word(["ale", "mushrooms", "pie"]))
  expect: "mushrooms"
- call: print(longest_word(["one", "two", "six"]))
  expect: "one"
- call: print(longest_word(["a"]))
  expect: "a"
  hidden: true
- call: print(longest_word(["hobbit", "dwarf", "wizards"]))
  expect: "wizards"
  hidden: true
```

```hint
Keep track of the best word so far. Start with `best = words[0]`, then for each word, replace `best` only if the new word is **strictly** longer.
```

```python solution
def longest_word(words):
    best = words[0]
    for word in words:
        if len(word) > len(best):
            best = word
    return best
```
