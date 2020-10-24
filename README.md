# Retro Proxy

This program does two things:

* bypass modern https, which requires encryption that vintage web browsers don't support
* attempts to modify modern web pages to make them usable on vintage web browsers and computer hardware

You can also selectively bypass the second part for sites you know will work.

# Quick Start

Assuming you have Node and Yarn installed:

```
git clone https://github.com/DrKylstein/retro-proxy.git
cd retro-proxy
yarn install
cp example.env .env
yarn start
```