---
id: javascript-basics-01
title: Hello, Console
order: 1
---

In JavaScript, `console.log()` prints a message. It's the first tool every JavaScript developer reaches for:

```javascript runnable
console.log('Hello, World!');
```

Press **Run** to see the output. Statements usually end with a semicolon `;`.

## Comments

`//` starts a comment that lasts until the end of the line. `/* ... */` can span several lines:

```javascript runnable
// This is ignored
console.log('Comments are for people'); /* so is this */
```

`console.log()` takes several values too, separated by commas:

```javascript
console.log('Second', 'breakfast'); // prints: Second breakfast
```

## Exercise: Greet the Shire

Write a program that prints exactly:

```
Hello, Shire!
```

```javascript exercise
// Write your code below
```

```tests
- call: ""
  expect: "Hello, Shire!"
```

```hint
Use `console.log()` with the text in quotes: `console.log("Hello, Shire!");`
```

```javascript solution
console.log('Hello, Shire!');
```
