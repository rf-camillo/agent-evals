# Writing scenarios

A scenario is one YAML document. A file can hold several, separated by `---`, and `run` accepts a file or a folder (searched recursively for `.yaml` and `.yml`). Unknown keys are errors, so a typo cannot silently turn a check off. Run `agent-evals validate <scenarios> --agent <module>` to check the files, and that every tool they mention exists, without calling any model.

## Fields

```yaml
id: availability-then-booking # required, lowercase words separated by hyphens, unique
description: A two-turn conversation that ends in a booking.
tags: [booking, multi-turn] # filter with --tag
turns: # required, played in order
  - user: "What classes do you have on Sunday October 4?"
  - user: "The hand building one sounds great. Book it for Leo Park."
facts: # extra truth for groundedness and the judge
  - "Classes last 90 minutes."
expect:
  tools: # calls that must happen
    - call: check_availability
      args: { date: "2026-10-04" }
    - call: book_class
      args: { classId: hand-1004-am, name: Leo Park }
  ordered: true # the calls above must happen in this order
  forbidTools: [cancel_booking] # calls that must never happen
  answer:
    contains: ["HB-"] # in the final answer
    notContains: ["discount"] # in any answer
  grounded: true # prices, times and dates must be backed
  handoff: false # true, false, or leave out to skip
judge:
  rubric: "First lists the classes with times and prices, then confirms the booking with a booking id."
```

## Argument matchers

| Matcher                           | Matches                                        |
| --------------------------------- | ---------------------------------------------- |
| `"Leo Park"`, `2`, `true`, `null` | The exact value (strict, `2` is not `"2"`)     |
| `{ regex: "^2026-10-" }`          | A string, number or boolean whose text matches |
| `{ oneOf: [a, b] }`               | Any of the listed values                       |
| `{ any: true }`                   | Any value, as long as the argument is present  |

Arguments that are not listed are ignored. Each actual call satisfies at most one expectation, so listing `book_class` twice requires two calls.

## Groundedness

With `grounded: true`, the checker extracts every price (`$45`, `R$ 1.234,56`, `€1,500`), clock time (`9:30`, `6:30 pm`, `9am`) and date (`2026-10-03`, `October 3rd`, `Oct. 3`) from the agent's answers, normalizes them, and requires each one to appear in:

- the output of a tool call that did not fail;
- the scenario's `facts`;
- or something the user said.

Tool inputs never count: the model wrote them, so they prove nothing. Plain numbers in the evidence also count as prices, so a tool returning `"priceUsd": 45` backs "$45". The flip side is that a tool returning `"seats": 45` would back it too; the check is a cheap safety net, and nuance belongs to the judge.

## Writing good rubrics

- **One behavior per rubric.** "Says the class is full and names one alternative with free seats" is gradable; "handles the request well" is not.
- **Say what failure looks like** when it is not obvious: "Does not claim a booking was made."
- **Prefer checks to rubrics** for anything a program can verify. Tool calls, forbidden tools and phrases are cheaper, faster and never disagree with themselves.
- **Calibrate** with at least one passing and one failing conversation for each kind of rubric you use. See [examples/harbor/calibration](../examples/harbor/calibration).

## Calibration cases

```yaml
id: invented-price
rubric: "Gives the price of the hand building class, taken from the tools."
facts: []
conversation:
  - user: "How much is hand building?"
    tools:
      - name: check_availability
        input: { date: "2026-10-04" }
        output: '{"classes":[{"title":"Hand Building","priceUsd":38}]}'
    agent: "Hand Building costs $32, and it's $28 if you bring your own clay."
expected: fail
```

`calibrate` grades every case and trusts the judge only if it agrees with at least `--min-agreement` of them (0.9 by default) and never errors.
