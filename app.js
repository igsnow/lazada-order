const express = require('express');
const app = express();


// {"account":"716810918@qq.com","pwd":"gyj388153@"}
// {"firstSku":"白色","secondSku":"XXl","num":3}

app.get('/:url/:sku/:pwd', function (req, res, page) {
    const puppeteer = require('puppeteer');
    const url = req.params.url;
    const sku = req.params.sku;
    const pwd = req.params.pwd;

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
            // waitUntil: 'load'
        });

        // 监听到导航栏url变化时，当登录成功时跳转到1688详情页
        if (page.url() === loginUrl) {
            while (true) {
                // await page.waitForNavigation({
                //     // waitUntil: 'load'
                // })
                if (page.url() !== loginUrl) {
                    await page.goto(detailUrl, {
                        // waitUntil: 'load'
                    });
                    break;
                }
            }
        }

        return

        // 4、SKU双属性、可展开
        let firstSku = '白色（001）';
        let secondSku = '2XL';
        let num = 5;

        // await page.tap('.sku-variable-img-wrap');

        await page.waitFor(300);

        // 获取商品sku数组
        const skuObj = await page.$$eval('.table-sku .name', (e, secondSku) => {
            let arr = [];
            let second_index = 0;
            for (let i = 0; i < e.length; i++) {
                // 如果sku有图片，则sku取span标签的title值
                if (e[i].children[0].title) {
                    arr.push(e[i].children[0].title)
                    if (e[i].children[0].title == secondSku) {
                        second_index = i
                    }
                } else {
                    arr.push(e[i].children[0].innerHTML)
                    if (e[i].children[0].innerHTML == secondSku) {
                        second_index = i
                    }
                }
            }
            return {arr, second_index};
        }, secondSku);
        console.log(skuObj);
        skuObj.second_index += 1;

        // 数量输入框得聚焦，不然sku下方的价格统计不显示
        let selector = '.table-sku tr:nth-child(' + skuObj.second_index + ') .amount-input';
        let up = '.table-sku tr:nth-child(' + skuObj.second_index + ') .amount-up';
        let down = '.table-sku tr:nth-child(' + skuObj.second_index + ') .amount-down';
        await page.focus(selector);
        console.log('=>sku数量输入框已获取焦点,等待输入...');

        await page.waitFor(300);

        // (坑2)自动填写商品数量，但是下方价格不改变，于是先自增一再减一，价格正确显示
        await page.$eval(selector, (input, num) => input.value = num, num);
        await page.waitFor(300);
        await page.tap(up);
        await page.waitFor(300);
        await page.tap(down);
        console.log('=>数量已自动填充完成!');

        // 失去输入框焦点
        // await page.evaluate((selector) => {
        //     document.querySelector(selector).blur()
        // }, selector)

        await page.waitFor(500);

        // 加入购物车
        await page.tap('.do-cart')
        console.log('加入购物车成功!')


        await page.goto('https://' + url, {
            // waitUntil: 'load'
        });
        await browser.close();

    })()
})

app.listen(3000, () => console.log('Server listening on port 3000!'));
