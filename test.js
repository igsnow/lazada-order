const puppeteer = require('puppeteer');


// let skuStr = '{"Color Family": "White", "Size": "5XL", "Quantity": 3}';
let skuStr = '{"Style": "Off-white", "Quantity": 5}';
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
    // let detailUrl = 'https://www.lazada.com.my/products/new-plus-size-s-5xl-floral-bomber-jacket-men-hip-hop-slim-fit-flowers-pilot-bomber-jacket-coat-mens-hooded-jackets-i581532837-s1164964719.html?';
    let detailUrl = 'https://www.lazada.com.my/products/nana-kitchen-shelves-wall-hangers-304-stainless-steel-microwave-oven-shelf-holder-storage-supplies-storage-shelf-angle-frame-i151234272-s592786175.html?'
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

    let skuObj = JSON.parse(skuStr);
    // 选择sku信息
    let classArr = await handleSku(page, skuObj);
    // console.log(classArr)

    // 先处理除图片sku属性
    let idx = 0;
    for (let i = 0; i < classArr.length; i++) {
        if (classArr[i] && classArr[i].className && classArr[i].className.includes('sku-variable-img-wrap')) {
            idx = i
        }
    }

    // 处理图片sku，由于图片元素没有title属性，比较复杂单独分析
    let imgSkuArr = classArr[idx];
    // console.log(imgSkuArr);

    await handleImgTap(page, imgSkuArr, skuObj, idx);

    return

    let newClassArr = JSON.parse(JSON.stringify(classArr));
    newClassArr.splice(idx, 1);
    // console.log(newClassArr);

    for (let i = 0; i < newClassArr.length; i++) {
        for (let j = 0; j < newClassArr[i].length; j++) {
            if (newClassArr[i][j] && newClassArr[i][j].className) {
                // 若sku属性禁用，则不再操作
                if (newClassArr[i][j].className.indexOf('disabled') > -1) {
                    console.log('disabled ' + i + ' ' + j)
                    continue
                }
                // 若已经默认选中，则不再操作且值是想要的值，则不再操作
                if (newClassArr[i][j].className.indexOf('selected') > -1 && newClassArr[i][j].title === newClassArr[i][j].value) {
                    console.log('selected ' + i + ' ' + j)
                    continue
                }
                // 若sku的当前option与预设的sku的value值相同，则点击
                if (newClassArr[i][j].title === newClassArr[i][j].value) {
                    console.log(newClassArr[i][j])
                    await page.$eval('.sku-prop .' + newClassArr[i][j].className + ':nth-child(' + (j + 1) + ')', el => el.click());
                }
            }
        }
    }

    // 填充商品数量
    await page.$eval('.next-number-picker-input input', (input, num) => input.value = num, skuObj.Quantity);
    // 点击"+"号，可能网站会有坑，直接修改input输入框的值，加入购物车时不生效，可以采取先增一个再减少一个即可
    // await page.$eval('.next-number-picker-handler-up', elem => elem.click());

    // 模拟延时1s
    await page.waitFor(1000);

    return

    // 加入购物车
    await page.tap('.pdp-button_theme_orange');
    console.log('=>加入购物车成功')

    // await browser.close();

})();

// 滑块处理函数
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

// 提取sku元素的className
async function handleSku(page, skuObj) {
    return await page.$$eval('#module_sku-select .sku-selector .sku-prop', (e, skuObj) => {
        let classArr = [];
        for (let i = 0; i < e.length; i++) {
            let title = e[i].children[0].children[0].innerHTML;
            // 获取skuImg点击后上面显示的sku-name
            let skuName = e[i].children[0].children[1].children[0].children[0].innerHTML;
            // 获取sku可选值的className
            let optionArr = e[i].children[0].children[1].children[1].children;
            let itemArr = [];
            for (let j = 0; j < optionArr.length; j++) {
                // 根据sku的key值获取sku的属性，绑定到sku的每个options上，方便后续判断点击操作
                itemArr.push({
                    className: optionArr[j].className,
                    title: optionArr[j].title || '',
                    skuName: skuName || '',
                    value: skuObj[title]
                })
            }
            classArr.push(itemArr)
        }
        return classArr
    }, skuObj);
}

// 图片sku点击
async function handleImgTap(page, imgSkuArr, skuObj, idx) {
    for (let i = 0; i < imgSkuArr.length; i++) {
        // 若sku属性禁用，则跳过
        if (imgSkuArr[i].className.indexOf('disabled') > -1) {
            console.log('disabled ' + i)
            continue
        }
        // 若已经默认选中，则不再操作且值是想要的值，则不再操作
        if (imgSkuArr[i].className.indexOf('selected') > -1 && imgSkuArr[i].skuName === imgSkuArr[i].value) {
            console.log('selected ' + i)
            continue
        }
        await page.$eval('.sku-prop .sku-variable-img-wrap' + ':nth-child(' + (i + 1) + ')', el => el.click());

        // 点击之后，重新获取当前元素的skuName，判断是否与期望一致
        let classArr = await handleSku(page, skuObj);
        let imgSkuArr2 = classArr[idx];
        // console.log(imgSkuArr2);
        if (imgSkuArr2[i].skuName === imgSkuArr2[i].value) {
            console.log('sku img selected success')
            break
        }
    }
}
