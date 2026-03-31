![Logo](admin/playstation.png)

# ioBroker.playstation

[![GitHub license](https://img.shields.io/github/license/Lucky-ESA/ioBroker.playstation)](https://github.com/Lucky-ESA/ioBroker.playstation/blob/main/LICENSE)
[![NPM version](https://img.shields.io/npm/v/iobroker.playstation.svg)](https://www.npmjs.com/package/iobroker.playstation)
[![Downloads](https://img.shields.io/npm/dm/iobroker.playstation.svg)](https://www.npmjs.com/package/iobroker.playstation)
![Number of Installations](https://iobroker.live/badges/playstation-installed.svg)
![GitHub size](https://img.shields.io/github/repo-size/Lucky-ESA/ioBroker.playstation)</br>
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/Lucky-ESA/ioBroker.playstation)
![GitHub commits since latest release](https://img.shields.io/github/commits-since/Lucky-ESA/ioBroker.playstation/latest)
![GitHub last commit](https://img.shields.io/github/last-commit/Lucky-ESA/ioBroker.playstation)
![GitHub issues](https://img.shields.io/github/issues/Lucky-ESA/ioBroker.playstation)</br>
**Version:** </br>
![Current version in stable repository](https://iobroker.live/badges/playstation-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.playstation.png?downloads=true)](https://nodei.co/npm/iobroker.playstation/)

**Tests:** </br>
[![Test and Release](https://github.com/Lucky-ESA/ioBroker.playstation/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/Lucky-ESA/ioBroker.playstation/actions/workflows/test-and-release.yml)
[![CodeQL](https://github.com/Lucky-ESA/ioBroker.playstation/actions/workflows/codeql.yml/badge.svg)](https://github.com/Lucky-ESA/ioBroker.playstation/actions/workflows/codeql.yml)
[![Known Vulnerabilities](https://snyk.io/test/github/Lucky-ESA/ioBroker.playstation/badge.svg)](https://snyk.io/test/github/Lucky-ESA/ioBroker.playstation)

## playstation adapter for ioBroker

You can wake up the Playstation or put it into standby mode. Some buttons are also possible. The PSN login can be used to load data from other players.

### Load possible information:</br>

- PlayList
- GameList
- Received requests
- Friends
- Blocked member
- Member online (status)
- SubscriptionList
- All Trophies
- Search Games
- Search Member
- Groups/Messages
- Send message (currently text message)
- Load voice message
- Accept friendship request
- Reject friendship requests
- Requests PS Stars
- Requests PS Store
- Profile

### Currently not available:</br>

- Load images messages

### In progress

- Storage infomration for PS5

### Remote control:</br>

|                  | PS4 | PS5 |
| ---------------- | --- | --- |
| Wake             | ✅  | ✅  |
| Standby          | ✅  | ✅  |
| Keyboard control | ✅  | ❌  |
| Key/Button press | ✅  | ❌  |
| App/Game start   | ✅  | ❌  |

## Requirements

- Node 20, 22 or 24
- JS-Controller >= 6.0.11
- Admin >= 7.6.17
- Playstation4/5

## Tested with

- PS4

## Description

🇬🇧 [Description](/docs/en/README.md)</br>
🇩🇪 [Beschreibung](/docs/de/README.md)

## Questions

🇩🇪 [Fragen](https://forum.iobroker.net/topic/79366/test-adapter-playstation?_=1738608406288)

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**

- (Lucky-ESA) Added Playstation Stars
- (Lucky-ESA) Added Playstation Store
- (Lucky-ESA) Fixed create folder
- (Lucky-ESA) Admin 7.6.17 required

### 0.0.3 (2025-02-14)

- (Lucky-ESA) Fixed bug when creating a group
- (Lucky-ESA) Friendship request accept added
- (Lucky-ESA) Friendship request reject added
- (Lucky-ESA) Added loading voice data from a message
- (Lucky-ESA) Added status restrictions as JSON
- (Lucky-ESA) Added meta object for attachments from message

### 0.0.2 (2025-02-05)

- (Lucky-ESA) Added groups and messages
- (Lucky-ESA) Added: Share Profile
- (Lucky-ESA) Load attachments from messages (raw data)

### 0.0.1 (2025-01-23)

- (Lucky-ESA) initial release

## License

MIT License

Copyright (c) 2025-2026 Lucky-ESA <github@luckyskills.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
