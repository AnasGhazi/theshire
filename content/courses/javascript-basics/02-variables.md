---
id: javascript-basics-02
title: Variables and Types
order: 2
---

JavaScript has two everyday ways to make a variable:

- `const` for values that won't be reassigned
- `let` for values that will change

```javascript runnable
const name = 'Bilbo';
let age = 110;
age = age + 1; // birthday!
console.log(name, 'is now', age);
```

## Template literals

Backtick strings (`` ` ``) can include values with `${...}`:

```javascript runnable
const meal = 'elevenses';
const hour = 11;
console.log(`${meal} is at ${hour} o'clock`);
```

## Types

`typeof` tells you what kind of value you have:

```javascript runnable
console.log(typeof 'pie'); // string
console.log(typeof 42); // number
console.log(typeof true); // boolean
```

## Functions

A function packages up code you can reuse. `return` sends a value back:

```javascript runnable
function shout(text) {
  return text.toUpperCase() + '!';
}
console.log(shout('hello'));
```

## Exercise: Introduce a hobbit

Write a function `introduce(name, age)` that **returns** `<name> is <age> years old.`

For example, `introduce("Sam", 38)` returns `"Sam is 38 years old."`.

```javascript exercise id=introduce
function introduce(name, age) {
  // return the sentence
}
```

```tests
- call: console.log(introduce("Sam", 38));
  expect: "Sam is 38 years old."
- call: console.log(introduce("Bilbo", 111));
  expect: "Bilbo is 111 years old."
- call: console.log(introduce("Pippin", 0));
  expect: "Pippin is 0 years old."
  hidden: true
```

```hint
Use a template literal: `` return `${name} is ${age} years old.`; ``
```

```javascript solution
function introduce(name, age) {
  return `${name} is ${age} years old.`;
}
```
