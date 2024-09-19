# Retro Proxy

This program does two things:

* bypass modern https, which requires encryption that vintage web browsers don't support
* attempts to modify modern web pages to make them usable on vintage web browsers and computer hardware

You can also selectively bypass the second part for retro sites by editing the file "allowed.txt".

# Quick Start

With Node installed, and Yarn installed via NPM:

```
git clone https://github.com/DrKylstein/retro-proxy.git
cd retro-proxy
yarn install
cp example.env .env
cp allowed.txt.example allowed.txt
yarn start
```

On Debian, Raspberry Pi, or Ubuntu, with Yarn installed from Apt:

```
git clone https://github.com/DrKylstein/retro-proxy.git
cd retro-proxy
yarnpkg install
cp example.env .env
cp allowed.txt.example allowed.txt
yarnpkg start
```
