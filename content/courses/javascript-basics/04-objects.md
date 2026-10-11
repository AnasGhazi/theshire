---
id: javascript-basics-04
title: Objects
order: 4
---

An **object** groups named values (called properties) together:

```javascript runnable
const hobbit = { name: 'Frodo', age: 50, home: 'Bag End' };
console.log(hobbit.name);
console.log(hobbit['home']);
hobbit.age = 51;
console.log(hobbit);
```

## Counting with objects

Objects are perfect for tallying things. If a key doesn't exist yet, it's `undefined`, so `?? 0` gives a starting value:

```javascript runnable
const tally = {};
for (const fruit of ['apple', 'pear', 'apple']) {
  tally[fruit] = (tally[fruit] ?? 0) + 1;
}
console.log(tally); // { apple: 2, pear: 1 }
```

## Arrow functions

Arrow functions are a shorter way to write small functions:

```javascript runnable
const double = (n) => n * 2;
console.log(double(21));
```

## Exercise: Word counter

Write `countWords(text)` that returns an object counting how many times each word appears. Words are separated by single spaces.

For example, `countWords("the cat the hat")` returns `{ the: 2, cat: 1, hat: 1 }`.

```javascript exercise id=count-words
function countWords(text) {
  // your code here
}
```

```tests
- call: console.log(JSON.stringify(countWords("the cat the hat")));
  expect: '{"the":2,"cat":1,"hat":1}'
- call: console.log(JSON.stringify(countWords("ale")));
  expect: '{"ale":1}'
- call: console.log(JSON.stringify(countWords("pie pie pie")));
  expect: '{"pie":3}'
  hidden: true
```

```hint
`text.split(" ")` turns the sentence into an array of words. Then loop over it and tally each word, like the fruit example above.
```

```javascript solution
function countWords(text) {
  const counts = {};
  for (const word of text.split(' ')) {
    counts[word] = (counts[word] ?? 0) + 1;
  }
  return counts;
}
```
