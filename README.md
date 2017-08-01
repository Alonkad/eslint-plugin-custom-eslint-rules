# eslint-plugin-custom-eslint-rules

custom eslint rules

## Installation

You'll first need to install [ESLint](http://eslint.org):

```
$ npm i eslint --save-dev
```

Next, install `eslint-plugin-custom-eslint-rules`:

```
$ npm install eslint-plugin-custom-eslint-rules --save-dev
```

**Note:** If you installed ESLint globally (using the `-g` flag) then you must also install `eslint-plugin-custom-eslint-rules` globally.

## Usage

Add `custom-eslint-rules` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
    "plugins": [
        "custom-eslint-rules"
    ]
}
```


Then configure the rules you want to use under the rules section.

```json
{
    "rules": {
        "custom-eslint-rules/rule-name": 2
    }
}
```

## Supported Rules

* Fill in provided rules here





