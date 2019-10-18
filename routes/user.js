const puppeteer = require('puppeteer');
const express = require('express');
const router = express.Router();

const log4js = require('log4js');
log4js.configure({
    appenders: {cheese: {type: 'file', filename: 'cheese.log'}},
    categories: {default: {appenders: ['cheese'], level: 'info'}}
});

const logger = log4js.getLogger('cheese');

const loginUrl = 'https://member.lazada.com.my/user/login?spm=a2o4k.home.header.d5.1f062e7e5nKtIB&redirect=https%3A%2F%2Fwww.lazada.com.my%2F%3Fspm%3Da2o4k.login_signup.header.dhome.4d3f49fb8YhnCt';

router.post("/lazada/order", function (req, res) {
    const detailUrl = req.body.detailUrl;
    const account = req.body.account;
    const pwd = req.body.pwd;
    const skuObj = req.body.sku && JSON.parse(req.body.sku);

    logger.info('sku参数已经收到' + JSON.stringify(req.body))

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

        // 先跳转至详情页，再弹出登录框
        await page.goto(detailUrl, {
            waitUntil: 'load'
        });

        logger.info('已经跳转到详情页');


        // await page.goto(loginUrl, {
        //     waitUntil: 'domcontentloaded'
        // });
        //
        // // 自动填入账号密码
        // let accountEl = '.mod-input-loginName input';
        // let pwdEl = '.mod-input-password input';
        // await page.waitForSelector(accountEl);
        // page.type(accountEl, account, {delay: 8});
        // await page.waitFor(1000);
        // await page.waitForSelector(pwdEl);
        // page.type(pwdEl, pwd, {delay: 8});
        // await page.waitFor(1000);
        //
        // // 如果开始是登录按钮，不是滑块，则先点击登录按钮
        // let isLoginBtnWrap = await page.$('.mod-login-btn');
        // if (!!isLoginBtnWrap) {
        //     await page.tap('.mod-login-btn button');
        // }

        // 自动拖动滑块验证
        // await handleSide(page)

        // let isError = await page.$('.errloading');
        // if (!!isError) {
        //     console.log('=>滑块报错了');
        //     await page.tap('.errloading a');
        //     console.log('=>已刷新');
        //     await handleSide(page)
        // }

        // 监听到导航栏url变化时，当登录成功时跳转到详情页
        // if (page.url() === loginUrl) {
        //     console.log('=>准备登录');
        //     while (true) {
        //         await page.waitForNavigation({
        //             waitUntil: 'domcontentloaded'
        //         });
        //         if (page.url() !== loginUrl) {
        //             console.log('=>登录成功！即将跳转详情页');
        //             await page.goto(detailUrl, {
        //                 waitUntil: 'load'
        //             });
        //             console.log('=>已跳转至详情页');
        //             break;
        //         }
        //     }
        // }

        // 选择sku信息
        let classArr = await handleSku(page, skuObj);

        logger.info('sku全部信息已经处理完 ' + classArr);


        // 先处理除图片sku属性
        let idx = 0;
        for (let i = 0; i < classArr.length; i++) {
            if (classArr[i] && classArr[i].className && classArr[i].className.includes('sku-variable-img-wrap')) {
                idx = i
            }
        }

        // 处理图片sku，由于图片元素没有title属性，比较复杂单独分析
        let imgSkuArr = classArr[idx];

        logger.info('sku图片信息 ' + imgSkuArr);

        await handleImgTap(page, imgSkuArr, skuObj, idx);

        let newClassArr = JSON.parse(JSON.stringify(classArr));
        newClassArr.splice(idx, 1);

        logger.info('sku除图片信息sku ' + newClassArr);

        for (let i = 0; i < newClassArr.length; i++) {
            for (let j = 0; j < newClassArr[i].length; j++) {
                if (newClassArr[i][j] && newClassArr[i][j].className) {
                    // 若sku属性禁用，则不再操作
                    if (newClassArr[i][j].className.indexOf('disabled') > -1) {
                        logger.info('sku disabled ' + i + ' ' + j)
                        continue
                    }
                    // 若已经默认选中，但值不是想要的值，则跳过
                    if (newClassArr[i][j].className.indexOf('selected') > -1 && newClassArr[i][j].title !== newClassArr[i][j].value) {
                        logger.info('sku default selected error ' + i + ' ' + j)
                        continue
                    }
                    // 若已经默认选中，则不再操作且值是想要的值，则不再操作
                    if (newClassArr[i][j].className.indexOf('selected') > -1 && newClassArr[i][j].title === newClassArr[i][j].value) {
                        logger.info('sku default selected success ' + i + ' ' + j)
                        break
                    }
                    // 若sku的当前option与预设的sku的value值相同，则点击
                    if (newClassArr[i][j].title === newClassArr[i][j].value) {
                        logger.info('sku selected success ' + i + ' ' + j)
                        await page.$eval('.sku-prop .' + newClassArr[i][j].className + ':nth-child(' + (j + 1) + ')', el => el.click());
                        break
                    }
                }
            }
        }

        // 填充商品数量
        await page.$eval('.next-number-picker-input input', (input, num) => input.value = num, skuObj.Quantity);
        logger.info('商品数量已经填写');

        // 若购买按钮存在则点击购买
        let buyBtnElClass = '.pdp-button_theme_yellow';
        let isBuyBtn = await page.$(buyBtnElClass);
        if (!!isBuyBtn) {
            await page.tap(buyBtnElClass);
            logger.info('已跳转至结算页')
        }

        // 等iframe的wrap出现
        await page.$('.mod-login-dialog-warp');

        // 获取元素内部的登录iframe
        const url = await page.$eval('.login-iframe', el => el.getAttribute('src'));
        const frames = await page.frames();
        for (let i of frames) {
            if (url.includes(i.url())) {
                var frame = i;
            }
        }

        logger.info('登录iframe弹框已捕捉')

        // 自动填充账号密码
        let accountEl = '.mod-input-loginName input';
        let pwdEl = '.mod-input-password input';

        await frame.waitForSelector(accountEl);
        await frame.focus(accountEl);
        await page.keyboard.type(account);

        logger.info('账号已经填写');

        await frame.waitFor(1000);

        await frame.waitForSelector(pwdEl);
        await frame.focus(pwdEl);
        await page.keyboard.type(pwd);

        logger.info('密码已经填写');

        // await frame.waitForSelector(accountEl);
        // frame.type(accountEl, account, {delay: 5});
        // await frame.waitFor(1000);
        // await frame.waitForSelector(pwdEl);
        // frame.type(pwdEl, pwd, {delay: 5});
        // await frame.waitFor(1000);


        // await handleSide(page)


        // 等待下单页面加载
        await page.waitForNavigation({
            waitUntil: 'domcontentloaded'
        });

        // 进入到订单页面点击下单按钮
        let OrderElClass = '.automation-checkout-order-total-button-button';
        let isOrderBtn = await page.$(OrderElClass);
        logger.info('等待下单按钮出现');
        if (!!isOrderBtn) {
            await page.tap(OrderElClass);
            logger.info('下单按钮已点击，等待跳转支付页面')
        }

        // 等待付款页面加载
        await page.waitForNavigation({
            waitUntil: 'domcontentloaded'
        });

        // 选择货到付款方式
        let payMethodElId = '#automation-payment-method-item-130'
        let payMethodBtn = await page.$(payMethodElId);
        logger.info('等待货到付款支付按钮');
        await page.tap(payMethodElId);
        logger.info('货到付款按钮已点击')

        // 关闭浏览器
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
                        value: parseValue(title, skuObj)
                    })
                }
                classArr.push(itemArr)
            }
            return classArr
        }, skuObj);
    }

    //兼容Color Family & Color family获取属性值
    function parseValue(title, skuObj) {
        if (title.indexOf('Color')) {
            return skuObj['Color']
        } else {
            return skuObj[title]
        }
    }

    // 图片sku点击
    async function handleImgTap(page, imgSkuArr, skuObj, idx) {
        for (let i = 0; i < imgSkuArr.length; i++) {
            // 若sku属性禁用，则跳过
            if (imgSkuArr[i].className.indexOf('disabled') > -1) {
                logger.info('img disabled ' + i)
                continue
            }
            // 若已经默认选中，但值不是想要的值，则跳过
            if (imgSkuArr[i].className.indexOf('selected') > -1 && imgSkuArr[i].skuName !== imgSkuArr[i].value) {
                logger.info('img default selected error ' + i)
                continue
            }
            // 若已经默认选中，且值是想要的值，则不再操作
            if (imgSkuArr[i].className.indexOf('selected') > -1 && imgSkuArr[i].skuName === imgSkuArr[i].value) {
                logger.info('img default selected success ' + i)
                break
            }
            await page.$eval('.sku-prop .sku-variable-img-wrap' + ':nth-child(' + (i + 1) + ')', el => el.click());

            // 点击之后，重新获取当前元素的skuName，判断是否与期望一致
            let classArr = await handleSku(page, skuObj);
            let imgSkuArr2 = classArr[idx];
            if (imgSkuArr2[i].skuName === imgSkuArr2[i].value) {
                logger.info('img selected success ' + i)
                break
            }
        }
    }

    res.send({status: 200, msg: 'post success'});
});


module.exports = router;
