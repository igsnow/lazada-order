const puppeteer = require('puppeteer');


// {"firstSku":"白色","secondSku":"XXl","num":3}
// {"account":"716810918@qq.com","pwd":"gyj388153@"}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,                     // 是否显示浏览器
        args: ['--start-maximized']          // 是否全屏显示
    });
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    });
    await page.setViewport({
        width: 1500,
        height: 900
    });

    // 先跳转到登录页
    let loginUrl = 'https://member.lazada.com.my/user/login?spm=a2o4k.home.header.d5.1f062e7e5nKtIB&redirect=https%3A%2F%2Fwww.lazada.com.my%2F%3Fspm%3Da2o4k.login_signup.header.dhome.4d3f49fb8YhnCt';
    let detailUrl = 'https://www.lazada.com.my/products/100-cotton-cadar-bedsheet-pillow-case-20-colour-i495564195-s904218335.html?';

    await page.goto(loginUrl, {
        waitUntil: 'domcontentloaded'
    });

    // 自动填入账号密码
    let accountEl = '.mod-input-loginName input';
    let pwdEl = '.mod-input-password input';
    await page.waitForSelector(accountEl);
    page.type(accountEl, '716810918@qq.com', {delay: 10});
    await page.waitFor(2000);
    await page.waitForSelector(pwdEl);
    page.type(pwdEl, 'gyj388153@', {delay: 10});
    await page.waitFor(1000);

    // await handleSide(page)

    let isError = await page.$('.errloading');
    if (!!isError) {
        console.log('报错了....')
        await page.tap('.errloading a');
        console.log('已刷新...')
        await handleSide(page)
    }

    // 监听到导航栏url变化时，当登录成功时跳转到详情页
    if (page.url() === loginUrl) {
        console.log('=>准备登录')
        while (true) {
            await page.waitForNavigation({
                waitUntil: 'load'
            })
            if (page.url() !== loginUrl) {
                console.log('=>登录成功！即将跳转详情页')
                await page.goto(detailUrl, {
                    waitUntil: 'domcontentloaded'
                });
                console.log('=>已跳转至详情页')
                break;
            }
        }
    }


    // await browser.close();

})();

async function handleSide(page) {
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
    await page.waitFor(3000);
    await page.mouse.up();
}
