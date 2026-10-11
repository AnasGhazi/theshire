---
id: javascript-basics-03
title: Arrays and Loops
order: 3
---

An **array** is an ordered list of values:

```javascript runnable
const meals = ['breakfast', 'second breakfast', 'elevenses'];
console.log(meals[0]); // first item
console.log(meals.length); // how many
meals.push('luncheon'); // add to the end
console.log(meals);
```

## for...of

`for...of` visits every item in an array:

```javascript runnable
for (const meal of ['breakfast', 'elevenses', 'supper']) {
  console.log(`Time for ${meal}`);
}
```

The classic counting loop works too:

```javascript runnable
for (let i = 1; i <= 3; i++) {
  console.log(i);
}
```

## filter and map

Arrays have built-in methods that take a function. `filter` keeps items that pass a test, and `map` transforms each item:

```javascript runnable
const numbers = [1, 2, 3, 4, 5];
console.log(numbers.filter((n) => n > 2)); // [ 3, 4, 5 ]
console.log(numbers.map((n) => n * 10)); // [ 10, 20, 30, 40, 50 ]
```

## Exercise: Only the evens

Write `evens(numbers)` that returns a **new array** with only the even numbers, in their original order.

```javascript exercise id=evens
function evens(numbers) {
  // your code here
}
```

```tests
- call: console.log(JSON.stringify(evens([1, 2, 3, 4])));
  expect: "[2,4]"
- call: console.log(JSON.stringify(evens([7, 9])));
  expect: "[]"
- call: console.log(JSON.stringify(evens([10, -2, 3, 0])));
  expect: "[10,-2,0]"
  hidden: true
```

```hint
A number is even when `n % 2 === 0`. Try `numbers.filter(...)`, or loop with `for...of` and `push` into a new array.
```

```javascript solution
function evens(numbers) {
  return numbers.filter((n) => n % 2 === 0);
}
```
