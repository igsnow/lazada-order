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
    // let detailUrl = 'https://www.lazada.com.my/products/free-shipping-spinarez-spinal-1-kingqueensuper-singlesingle-10-inch-euro-top-foam-padding-coconut-fiber-bonell-spring-hybrid-mattress-tilam-10-years-warranty-i207914898-s259016584.html?spm=a2o4k.home.flashSale.2.1a762e7eDVXu0T&search=1&mp=1&c=fs&clickTrackInfo=%7B%22rs%22%3A%220.49123629950286524%22%2C%22submission_discount%22%3A%2246%25%22%2C%22rmc%22%3A%2244%22%2C%22type%22%3A%22entrance%22%2C%22isw%22%3A%220.3%22%2C%22userid%22%3A%22%22%2C%22sca%22%3A%2225%22%2C%22hourtonow%22%3A%2214%22%2C%22abid%22%3A%22142638%22%2C%22itemid%22%3A%22207914898_0_itself_0.10954014814395574_0.49123629950286524%22%2C%22pvid%22%3A%22910d9565-22fe-4afe-8b7c-1675c279870e%22%2C%22pos%22%3A%220%22%2C%22ccw%22%3A%220.1%22%2C%22rms%22%3A%220.42718446601941745%22%2C%22c2i%22%3A%220.15247942977625034%22%2C%22scm%22%3A%221007.17760.142638.%22%2C%22rmw%22%3A%220.04166714892533479%22%2C%22isrw%22%3A%220.1%22%2C%22rkw%22%3A%220.4%22%2C%22ss%22%3A%220.10954014814395574%22%2C%22i2i%22%3A%220.074%22%2C%22ms%22%3A%220.10954014814395574%22%2C%22itr%22%3A%220.18666666666666668%22%2C%22mt%22%3A%22itself%22%2C%22its%22%3A%22300%22%2C%22promotion_price%22%3A%22375.00%22%2C%22anonid%22%3A%22nfGIZqdRBp7NgyJKAy6Qth4TPM94qLx8%22%2C%22ppw%22%3A%220.0%22%2C%22isc%22%3A%2256%22%2C%22iss2%22%3A%220.49706300393758573%22%2C%22iss1%22%3A%220.01644157369348209%22%2C%22config%22%3A%22%22%7D&scm=1007.17760.142638.0'
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
                waitUntil: 'domcontentloaded'
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

    let skuInfo = await page.$$eval('#module_sku-select .sku-selector .sku-prop', (e, skuObj) => {
        let keyArr = [];
        let classArr = [];
        for (let i = 0; i < e.length; i++) {
            let title = e[i].children[0].children[0].innerHTML;
            // 获取sku键的集合
            keyArr.push(title);
            // 获取sku可选值的className
            let optionArr = e[i].children[0].children[1].children[1].children;
            let itemArr = [];
            for (let j = 0; j < optionArr.length; j++) {
                // 根据sku的key值获取sku的属性，绑定到sku的每个options上，方便后续判断点击操作
                itemArr.push({
                    className: optionArr[j].className,
                    title: optionArr[j].title || '',
                    value: skuObj[title]
                })
            }
            classArr.push(itemArr)
        }
        return {keyArr, classArr}
    }, skuObj);

    // console.log(skuInfo)

    // 先处理除Color Family之外的sku的点击，图片sku比较特殊
    let allClassArr = skuInfo.classArr;
    let idx = 0;
    for (let i = 0; i < allClassArr.length; i++) {
        if (allClassArr[i] && allClassArr[i].className && allClassArr[i].className.includes('sku-variable-img-wrap')) {
            idx = i
        }
    }
    let newClassArr = JSON.parse(JSON.stringify(allClassArr));
    newClassArr.splice(idx, 1);
    // console.log(newClassArr);


    for (let i = 0; i < newClassArr.length; i++) {
        for (let j = 0; j < newClassArr[i].length; j++) {
            if (newClassArr[i][j] && newClassArr[i][j].className) {
                // 若sku属性禁用或者已经默认选中，则不再操作
                if (newClassArr[i][j].className.indexOf('selected') > -1 || newClassArr[i][j].className.indexOf('disabled') > -1) {
                    console.log('selected ' + i + ' ' + j)
                    continue
                }
                if (newClassArr[i][j].title === newClassArr[i][j].value) {
                    console.log(newClassArr[i][j])
                    await page.$eval('.sku-prop .' + newClassArr[i][j].className + ':nth-child(' + (j + 1) + ')', el => el.click());
                }
            }
        }
    }


    return

    // 若有Color Family等sku属性

    // 若有Size等sku属性
    if (skuInfo.includes('Size')) {
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
            await page.$eval('.sku-prop-selection .sku-variable-size:nth-child(' + (sizeIdx.index + 2) + ')', el => el.click());
        }
    }

    // 填充商品数量
    await page.$eval('.next-number-picker-input input', (input, num) => input.value = num, skuObj.Quantity);
    // 点击"+"号，可能网站会有坑，直接修改input输入框的值，加入购物车时不生效，可以采取先增一个再减少一个即可
    // await page.$eval('.next-number-picker-handler-up', elem => elem.click());

    // 模拟延时1s
    await page.waitFor(1000);
    // 加入购物车
    await page.tap('.pdp-button_theme_orange');
    console.log('=>加入购物车成功')

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
