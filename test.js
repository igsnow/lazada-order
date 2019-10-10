const puppeteer = require('puppeteer');


let skuStr = '{"Color Family": "Blue", "Size": "5XL", "Quantity": 3}';
let infoStr = '{"account": "716810918@qq.com", "pwd": "gyj388153@"}';

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
    let detailUrl = 'https://www.lazada.com.my/products/new-plus-size-s-5xl-floral-bomber-jacket-men-hip-hop-slim-fit-flowers-pilot-bomber-jacket-coat-mens-hooded-jackets-i581532837-s1164964719.html?';

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
                    waitUntil: 'load'
                });
                console.log('=>已跳转至详情页')
                break;
            }
        }
    }

    // 选择sku逻辑
    let skuObj = JSON.parse(skuStr)
    console.log(skuObj);

    let skuKeyArr = await page.$$eval('#module_sku-select .sku-selector .sku-prop', (e, skuObj) => {
        let arr = [];
        for (let i = 0; i < e.length; i++) {
            let title = e[i].children[0].children[0].innerHTML;
            arr.push(title)
        }
        return arr
    }, skuObj);

    console.log(skuKeyArr)

    // 若有Color Family等sku属性

    // 若有Size等sku属性
    if (skuKeyArr.includes('Size')) {
        console.log('has size')
        let sizeVal = skuObj.Size;

        // 先判断系统默认选中的sku属性是否是需要的属性
        let hasSelected = await page.$eval('.sku-variable-size-selected', (e, sizeVal) => {
            if (e.title === sizeVal) return true
            return false
        }, sizeVal);
        console.log('Size是否已经默认选中: ' + hasSelected);

        if (!hasSelected) {
            let sizeIdx = await page.$$eval('.sku-variable-size', (e, sizeVal) => {
                let index = 0;
                for (let i = 0; i < e.length; i++) {
                    if (e[i].title === sizeVal) {
                        index = i;
                        break
                    }
                }
                let len = e.length
                return {index, len}
            }, sizeVal);
            console.log(sizeIdx);
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
