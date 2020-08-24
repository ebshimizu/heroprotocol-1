# Changelog

# latest // 2.0.2 - 2020-06-11

- FIX: Better `storm-replay` logic.
- FIX: Better testing logic to not fail without `storm-replay`
- FIX: Updated dependencies for vulnerabilities

# 2.0.1 - 2020-06-10

- FIX: Blizzard changed their `heroprotocol` directory structure.

# 2.0.0 - 2018-10-18

- ADD: Sample replays
- ADD: Logging
- ADD: Tests
- ADD: npm versioning

# 2.0.0-alpha

- Add in support for `storm-replay` for intelligent OSes (MacOS and Linux)
- Docker
- Files unprocessed (battlelobby, etc) will be passed through as buffers.

# 1.0.1

- Added ability to whitelist game, message, and tracker events based on key-value matches
- Improved archive caching and added a boolean argument to `.open` that controls whether a cached version should be loaded (if possible).
- Fixed issue with `header` always being archived under `protocol29406` instead of the proper build.
- Oldest build tested is build `44256`.

# 0.3.2 - 2017-06-22

- Fixed issue with `lib/decoders.js` that prevented use of the `initdata` flag.

# 0.3.1 - 2016-03-24

- Fixed issue with bitwise operators on numbers above 32 bits.

# 0.3.0 - 2016-03-21

- Changed dependencies
- Uses normalized paths
- Made output more orderly
- Fixed typos and failure tests

# 0.2.2 - 2016-03-19

- Automated protocol port

# 0.2.1 - 2016-01-31

- Support NodeJS v4.x.x
- Properly parse string Buffer in events

# 0.2.0 - 2016-01-31

- `heroprotocol.js` API streamlined.
- Every protocol ported, including PTR patch 16.0 protocol.
- Added Changelog and Todo.
- Switch to javascript strict mode.

# 0.1.2 - 2016-01-28

- Breaking bug correction where `heroprotocol.js` required a local dependency instead of using the npm one
- Initial reference for `replay.message.events` and `replay.message.tracker`.
- `data.js` collection of replay constants.

# 0.1.1 - 2016-01-27

- Inital reference for replay `header`, `replay.details` and `replay.initdata`.
- `bin/extract.js` replay bulk extraction tool.
- Basic replay abstraction.

# 0.1.0 - 2016-01-26

- Initial release.
