const express = require('express')
const app = express()

app.get('/:url', function (req, res, page) {
    const puppeteer = require('puppeteer');
    const url = req.params.url;
    // const selector = req.params.selector;
    (async () => {
        const browser = await puppeteer.launch({
            headless: false,                     // 是否显示浏览器
            args: ['--start-maximized']          // 是否全屏显示
        });
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });
        await page.setViewport({
            width: 1500,
            height: 900
        });

        await page.goto('https://' + url, {
            // waitUntil: 'load'
        });

    })()
})

app.listen(3000, () => console.log('Example app listening on port 3000!'))
