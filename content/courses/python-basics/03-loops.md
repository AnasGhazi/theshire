---
id: python-basics-03
title: Loops
order: 3
---

Loops repeat code so you don't have to. A `for` loop runs once for each item in a sequence. `range(3)` gives you `0`, `1`, `2`:

```python runnable
for i in range(3):
    print(i)
```

Try changing the range. `range(1, 6)` starts at 1 and stops **before** 6.

## Building up a total

A common pattern is to start a variable at zero and add to it inside the loop:

```python runnable
total = 0
for meal in [1, 2, 3, 4, 5, 6, 7]:
    total = total + 1
print("Meals today:", total)
```

## while loops

A `while` loop keeps going as long as its condition is true:

```python runnable
pies = 3
while pies > 0:
    print("Eating a pie,", pies, "left")
    pies -= 1
print("All gone!")
```

Careful: if the condition never becomes false, the loop runs forever. Here that just means the sandbox stops it after a few seconds.

## Exercise: Sum to N

Write `sum_to(n)` that returns `1 + 2 + ... + n`.

```python exercise id=sum-to-n
def sum_to(n):
    # your code here
    pass
```

```tests
- call: print(sum_to(3))
  expect: "6"
- call: print(sum_to(10))
  expect: "55"
- call: print(sum_to(1))
  expect: "1"
  hidden: true
- call: print(sum_to(100))
  expect: "5050"
  hidden: true
```

```hint
Start with `total = 0`, loop over `range(1, n + 1)`, add each number to `total`, then `return total`.
```

```python solution
def sum_to(n):
    total = 0
    for i in range(1, n + 1):
        total += i
    return total
```
