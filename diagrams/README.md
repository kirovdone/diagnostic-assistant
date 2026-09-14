# Diagrams

Three views, each as a standalone SVG and a 2400px PNG. The SVGs are self-contained — their
own `<style>`, literal colours, no CSS variables, no web fonts, no external references — so
they drop straight into slides and render the same outside this repository.

| File | What it shows |
|---|---|
| `use-case.svg` | Who uses the system and for what. Three human actors, the system boundary, and the AWS services behind it |
| `architecture.svg` | How it runs. Offline builds the index, live is arithmetic on it, and the 3-second budget covers only the live band |
| `chat-sequence.svg` | One session, twenty-five numbered steps across six participants |

The sequence view draws the session as conversational turns, because that is what both the
protocol and the screen are: the browser posts one answer, the server re-ranks and streams the
next question, and `/diagnose` renders it as a chat transcript with the composer at the bottom.
The ranking is part of the assistant's reply rather than a panel beside it, and each turn
carries the ranking it was written with, so scrolling back shows what the user was actually
looking at rather than the latest numbers pasted over history.


Colour carries meaning rather than decoration:

- **white** the system's own deterministic code
- **purple** a model call, on Bedrock
- **teal** state — S3, OpenSearch, DynamoDB
- **green** the outcome, the only ground truth the product produces
- **blue** a person

Regenerate with the scripts in the scratchpad that produced them; the geometry for the
architecture and use-case views comes from one generator so they stay visually consistent.
Every value on them is measured output, not illustration.
