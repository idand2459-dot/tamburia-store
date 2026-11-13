# Code Style

- End every statement with a semicolon, as the existing code does.

```js
const value = getValue();
```

## File size and organization
- There is no maximum number of lines per file. A cohesive file of 350–500 lines is better than one responsibility spread over several tiny files.
- Split a file when it holds two independent responsibilities or when something is reused elsewhere, not because it is long. Do not merge unrelated responsibilities just to reduce the file count.
- A component, helper or hook used by exactly one file and with no independent test or meaning lives in that file. Keep a small file when it is a real boundary: a shared contract, a layer (route, controller, service, repository), or something tested on its own.

Match the surrounding code for everything this file does not cover.
