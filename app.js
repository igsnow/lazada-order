const express = require('express');
const app = express();

// {"firstSku":"白色","secondSku":"XXl","num":3}
// {"account":"716810918@qq.com","pwd":"gyj388153@"}

app.get('/:url/:sku/:info', function (req, res, page) {
    const puppeteer = require('puppeteer');
    const url = req.params.url;
    const sku = req.params.sku;
    const info = req.params.info && JSON.parse(req.params.info);
    let account = info && info.account;
    let pwd = info && info.pwd;

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

        // 先跳转到登录页
        let loginUrl = 'https://member.lazada.com.my/user/login?spm=a2o4k.home.header.d5.1f062e7e5nKtIB&redirect=https%3A%2F%2Fwww.lazada.com.my%2F%3Fspm%3Da2o4k.login_signup.header.dhome.4d3f49fb8YhnCt';
        let homeUrl = 'https://www.lazada.com.my/?spm=a2o4k.login_signup.header.dhome.4d3f49fb8YhnCt'
        let detailUrl = 'https://www.lazada.com.my/products/100-cotton-cadar-bedsheet-pillow-case-20-colour-i495564195-s904218335.html?';

        await page.goto(loginUrl, {
            waitUntil: 'domcontentloaded'
        });

        // 自动填入账号密码
        let accountEl = '.mod-input-loginName input';
        let pwdEl = '.mod-input-password input';
        await page.waitForSelector(accountEl);
        page.type(accountEl, account, {delay: 10})
        await page.waitFor(3000);
        await page.waitForSelector(pwdEl);
        page.type(pwdEl, pwd, {delay: 10})
        await page.waitFor(1000);

        // 拖动验证滑块
        const start = await page.waitForSelector('.nc_iconfont.btn_slide');
        const startInfo = await start.boundingBox();

        const end = await page.waitForSelector('.nc-lang-cnt');
        const endInfo = await end.boundingBox();

        await page.mouse.move(startInfo.x, endInfo.y);
        await page.mouse.down();

        for (let i = 0; i < endInfo.width; i = i + 5) {
            await page.mouse.move(startInfo.x + i, endInfo.y);
        }
        await page.waitFor(3000)
        await page.mouse.up();


        // await browser.close();

    })();
})

app.listen(1017, () => console.log('Server listening on port 1017!'));
