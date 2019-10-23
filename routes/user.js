const puppeteer = require('puppeteer');
const whiteList = require('../db/whiteList');
const log4js = require('log4js');
log4js.configure({
    appenders: {cheese: {type: 'file', filename: 'cheese.log'}},
    categories: {default: {appenders: ['cheese'], level: 'info'}}
});
const logger = log4js.getLogger('cheese');
const errorUrl = 'https://bixi.alicdn.com/punish/10815.html?uuid=b44a49ab29180ddc34fcf36a129cd1ad';

module.exports = function (router, io) {
    // 自动下单
    router.post("/lazada/order", function (req, res) {
        const detailUrl = req.body.detailUrl;
        const account = req.body.account;
        const pwd = req.body.pwd;
        const skuObj = req.body.sku && JSON.parse(req.body.sku);

        let msg = 'sku参数已经收到 ';
        logger.info(msg + JSON.stringify(req.body));
        io.emit('successMsg', msg);

        try {
            (async () => {
                const browser = await puppeteer.launch({
                    headless: true,                     // 是否显示浏览器
                    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']          // 是否全屏显示
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

                let msg = '准备跳转到详情页';
                logger.info(msg);
                io.emit('successMsg', msg);

                try {
                    // 先跳转至详情页，再弹出登录框
                    await page.goto(detailUrl, {
                        waitUntil: 'load'
                    });
                    if (page.url() === errorUrl) {
                        // 如果跳转到异常页面，则抛出异常
                        let msg = '爬虫被检测到，已跳转到异常页面';
                        logger.error(msg);
                        io.emit('errorMsg', msg);
                        let errHtml = await page.$eval('#block-lzd-page-title', el => el.innerHTML);
                        await handleBrowserClose('异常页面html: ' + errHtml, browser);
                        return
                    } else {
                        let msg = '已经跳转到详情页';
                        logger.info(msg);
                        io.emit('successMsg', msg);
                    }
                } catch (e) {
                    await handleBrowserClose(e, browser);
                    return
                }

                logger.info('开始整理sku信息');

                // 收集sku信息并删除默认的disabled类名后缀
                let classArr = await handleSku(page, skuObj);

                logger.info('sku全部信息已经整理完 ' + JSON.stringify(classArr));

                // 判断是否有图片sku且重置默认点击
                let idx = 0;
                let hasImgSku = false;
                try {
                    for (let i = 0; i < classArr.length; i++) {
                        for (let j = 0; j < classArr[i].length; j++) {
                            if (classArr[i] && classArr[i][j] && classArr[i][j].className && classArr[i][j].className.indexOf('sku-variable-img-wrap') > -1) {
                                idx = i;
                                hasImgSku = true;
                            }
                            if (classArr[i] && classArr[i][j] && classArr[i][j].className && classArr[i][j].className.indexOf('selected') > -1) {
                                await page.$eval('.sku-prop .' + classArr[i][j].className, el => el.click());
                                logger.info('第' + (i + 1) + '个sku已重置sku默认点击');
                            }
                        }
                    }
                } catch (e) {
                    await handleBrowserClose(e, browser);
                    return
                }
                let msg2 = '是否有图片sku信息: ';
                logger.info(msg2 + hasImgSku + ' ' + idx);
                io.emit('successMsg', msg2 + hasImgSku);

                let newClassArr;
                // 如果有图片sku
                if (hasImgSku) {
                    // 处理图片sku，由于图片元素没有title属性，比较复杂单独分析
                    let imgSkuArr = classArr[idx];
                    logger.info('图片sku信息 ' + JSON.stringify(imgSkuArr));
                    let msg = '开始点击图片sku';
                    logger.info(msg);
                    io.emit('successMsg', msg);
                    try {
                        // 点击图片sku
                        await handleImgTap(page, imgSkuArr, skuObj, idx, browser);
                    } catch (e) {
                        await handleBrowserClose(e, browser);
                        return
                    }
                    newClassArr = JSON.parse(JSON.stringify(classArr));
                    newClassArr.splice(idx, 1);
                    logger.info('sku除图片信息sku ' + JSON.stringify(newClassArr));
                } else {
                    newClassArr = classArr;
                    logger.info('sku信息(无图) ' + JSON.stringify(newClassArr));
                }

                try {
                    let msg = '开始点击无图sku';
                    logger.info(msg);
                    io.emit('successMsg', msg);
                    for (let i = 0; i < newClassArr.length; i++) {
                        for (let j = 0; j < newClassArr[i].length; j++) {
                            if (newClassArr[i][j] && newClassArr[i][j].className) {
                                // 若sku属性禁用，则不再操作
                                if (newClassArr[i][j].className.indexOf('disabled') > -1) {
                                    logger.info('sku disabled ' + i + ' ' + j);
                                    continue
                                }
                                // 若已经默认选中，但值不是想要的值，则跳过
                                if (newClassArr[i][j].className.indexOf('selected') > -1 && newClassArr[i][j].title !== newClassArr[i][j].value) {
                                    logger.info('sku default selected error ' + i + ' ' + j);
                                    continue
                                }
                                // 若已经默认选中，则不再操作且值是想要的值，则不再操作
                                if (newClassArr[i][j].className.indexOf('selected') > -1 && newClassArr[i][j].title === newClassArr[i][j].value) {
                                    logger.info('sku default selected success ' + i + ' ' + j);
                                    break
                                }
                                // 若sku的当前option与预设的sku的value值相同，则点击
                                if (newClassArr[i][j].title === newClassArr[i][j].value) {
                                    logger.info('sku selected success ' + i + ' ' + j);
                                    let val = await page.$eval('.sku-prop .' + newClassArr[i][j].className + ':nth-child(' + (j + 1) + ')', el => {
                                        let preClassName = el.className;
                                        el.click();
                                        let afterClassName = el.className;
                                        return {preClassName, afterClassName}
                                    });
                                    logger.info('selected sku className: ' + JSON.stringify(val));
                                    let cname = val.afterClassName;
                                    if (cname.indexOf('selected') > -1) {
                                        let msg = '预期的无图sku有货';
                                        logger.info(msg);
                                        io.emit('successMsg', msg);
                                    } else {
                                        await handleBrowserClose('预期的无图sku无货', browser);
                                        return
                                    }
                                    break
                                }
                            }
                        }
                    }
                } catch (e) {
                    await handleBrowserClose(e, browser);
                    return
                }

                try {
                    // 填充商品数量
                    logger.info('等待sku数量输入框');
                    let inputClass = '.next-number-picker-input input';
                    await page.waitForSelector(inputClass);
                    await page.$eval(inputClass, (input, num) => input.value = num, skuObj.Quantity);
                    let numVal = await page.$eval('.next-number-picker-input input', el => el.value);
                    let msg = '商品数量已经填写: ' + Number(numVal) + ',预期数量: ' + skuObj.Quantity;
                    logger.info(msg);
                    io.emit('successMsg', msg);
                    if (Number(numVal) !== skuObj.Quantity) {
                        await handleBrowserClose('商品填写数量与预期值不一致！关闭浏览器', browser);
                        return
                    }
                } catch (e) {
                    await handleBrowserClose(e, browser);
                    return
                }

                try {
                    // 若购买按钮存在则点击购买
                    logger.info('等待购买按钮');
                    let buyBtnClass = '.pdp-button_theme_yellow';
                    await page.waitForSelector(buyBtnClass);
                    await page.$eval(buyBtnClass, el => el.click());
                    let msg = '已点击购买按钮';
                    logger.info(msg);
                    io.emit('successMsg', msg);
                } catch (e) {
                    await handleBrowserClose(e, browser);
                    return
                }

                try {
                    let msg = '开始捕捉登录iframe弹框';
                    logger.info(msg);
                    io.emit('successMsg', msg);
                    await page.waitForSelector('.next-dialog-wrapper');
                    // 获取元素内部的登录iframe
                    const url = await page.$eval('.login-iframe', el => el.getAttribute('src'));
                    const frames = await page.frames();
                    for (let i of frames) {
                        if (i.url().indexOf(url)) {
                            var frame = i;
                        }
                    }
                    let msg2 = '登录iframe弹框已捕捉，url: ' + url;
                    logger.info(msg2);
                    io.emit('successMsg', msg2);
                } catch (e) {
                    await handleBrowserClose(e, browser);
                    return
                }

                // 自动填充账号密码
                let accountEl = '.mod-input-loginName input';
                let pwdEl = '.mod-input-password input';
                try {
                    await frame.waitForSelector(accountEl);
                    await frame.focus(accountEl);
                    await page.keyboard.type(account);
                    let accountVal = await frame.$eval(accountEl, el => el.value);
                    let msg = '账号已经填写: ' + accountVal;
                    logger.info(msg);
                    io.emit('successMsg', msg);
                    if (accountVal !== account) {
                        await handleBrowserClose('账号输入有误', browser);
                        return
                    }
                } catch (e) {
                    await handleBrowserClose(e, browser);
                    return
                }

                try {
                    await frame.waitForSelector(pwdEl);
                    await frame.focus(pwdEl);
                    await page.keyboard.type(pwd);
                    let pwdVal = await frame.$eval(pwdEl, el => el.value);
                    let msg = '密码已经填写: ' + pwdVal;
                    logger.info(msg);
                    io.emit('successMsg', msg);
                    if (pwdVal !== pwd) {
                        await handleBrowserClose('密码输入有误', browser);
                        return
                    }
                } catch (e) {
                    await handleBrowserClose(e, browser);
                    return
                }

                try {
                    // 如果开始是登录按钮，不是滑块，则先点击登录按钮
                    let isLoginBtnWrap = await frame.$('.mod-login-btn');
                    if (!!isLoginBtnWrap) {
                        await frame.tap('.mod-login-btn button');
                        logger.info('点击登录按钮，显示拖动滑块')
                    }
                } catch (e) {
                    logger.warn('没有登录按钮，直接拖动')
                } finally {
                    await handleSide(page, frame);
                }

                try {
                    // 等待下单页面加载
                    await page.waitForNavigation({
                        waitUntil: 'domcontentloaded'
                    });
                    logger.info('等待下单按钮');
                    let orderBtnClass = '.automation-checkout-order-total-button-button';
                    await page.waitForSelector(orderBtnClass);
                    await page.$eval(orderBtnClass, el => el.click());
                    let msg = '下单按钮已点击，等待跳转支付页面';
                    logger.info(msg);
                    io.emit('successMsg', msg);
                } catch (e) {
                    await handleBrowserClose(e, browser);
                    return
                }

                try {
                    // 等待付款页面加载
                    await page.waitForNavigation({
                        waitUntil: 'domcontentloaded'
                    });
                    logger.info('等待货到付款支付按钮');
                    let payBtnClass = '.right-item';
                    await page.waitForSelector(payBtnClass);
                    let className = await page.$eval(payBtnClass, el => el.className);
                    logger.info('货到付款按钮的className: ' + className);
                    if (className.indexOf('unavailable') > -1) {
                        await handleBrowserClose('该订单不支持货到付款方式', browser);
                        return
                    } else {
                        await page.$eval(payBtnClass, el => el.click());
                        let msg = '货到付款按钮已点击';
                        logger.info(msg);
                        io.emit('successMsg', msg);
                    }
                } catch (e) {
                    await handleBrowserClose(e, browser);
                    return
                }

                try {
                    logger.info('等待确认订单按钮');
                    let confirmBtnClass = '.btn-place-order-wrap button';
                    await page.waitForSelector(confirmBtnClass);
                    await page.$eval(confirmBtnClass, el => el.click());
                    let msg = '确认订单按钮已点击';
                    logger.info(msg);
                    io.emit('successMsg', msg);
                } catch (e) {
                    await handleBrowserClose(e, browser);
                    return
                }

                await browser.close();
                let msg3 = '下单完毕，关闭浏览器';
                logger.info(msg3);
                io.emit('successMsg', msg3);
                successMsg();

            })();
        } catch (e) {
            logger.error(e)
        }

        // 滑块处理函数
        async function handleSide(page, frame) {
            // 拖动验证滑块
            const start = await frame.waitForSelector('.nc_iconfont.btn_slide');
            const startInfo = await start.boundingBox();

            const end = await frame.waitForSelector('.nc-lang-cnt');
            const endInfo = await end.boundingBox();

            await page.mouse.move(startInfo.x, endInfo.y);
            await page.mouse.down();

            let msg = '开始拖动滑块，预期拖动值： ' + endInfo.y;
            logger.info(msg);
            io.emit('successMsg', msg);

            for (let i = 0; i < endInfo.width; i = i + 5) {
                await page.mouse.move(startInfo.x + i, 2000);   // endInfo.y
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
                        let str = optionArr[j].className.replace("-disabled", "");
                        itemArr.push({
                            className: str,
                            title: optionArr[j].title || '',
                            skuName: skuName || '',
                            value: skuObj[title] || skuObj['Color'] || ''
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
        async function handleImgTap(page, imgSkuArr, skuObj, idx, browser) {
            for (let i = 0; i < imgSkuArr.length; i++) {
                // 若sku属性禁用，则跳过
                if (imgSkuArr[i].className.indexOf('disabled') > -1) {
                    logger.info('img disabled ' + i);
                    continue
                }
                // 若已经默认选中，但值不是想要的值，则跳过
                if (imgSkuArr[i].className.indexOf('selected') > -1 && imgSkuArr[i].skuName !== imgSkuArr[i].value) {
                    logger.info('img default selected error ' + i);
                    continue
                }
                // 若已经默认选中，且值是想要的值，则不再操作
                if (imgSkuArr[i].className.indexOf('selected') > -1 && imgSkuArr[i].skuName === imgSkuArr[i].value) {
                    logger.info('img default selected success ' + i);
                    break
                }
                await page.$eval('.sku-prop .sku-variable-img-wrap' + ':nth-child(' + (i + 1) + ')', el => el.click());

                // 点击之后，重新获取当前元素的skuName，判断是否与期望一致
                let classArr2 = await handleSku(page, skuObj);
                let imgSkuArr2 = classArr2[idx];
                logger.info('imgSkuArr2 ' + JSON.stringify(imgSkuArr2));
                if (imgSkuArr2[i].skuName === imgSkuArr2[i].value) {
                    logger.info('img selected success ' + i);
                    logger.info('选中图片sku的className: ' + imgSkuArr2[i].className);
                    if (imgSkuArr2[i].className && imgSkuArr2[i].className.indexOf('selected') > -1) {
                        let msg = '预期的图片sku有货';
                        logger.info(msg);
                        io.emit('successMsg', msg);
                    } else {
                        await handleBrowserClose('预期的图片sku无货', browser);
                        return
                    }
                    break
                }
            }
        }

        // 异常后退出浏览器
        async function handleBrowserClose(e, browser) {
            logger.error(e);
            await browser.close();
            logger.info('关闭浏览器');
            io.emit('errorMsg', '下单异常，浏览器已关闭！' + e);
            errorMsg()
        }

        // 下单异常
        function errorMsg() {
            res.json({status: 500, msg: 'fail', title: '下单异常！'})
        }

        // 下单成功
        function successMsg() {
            res.json({status: 200, msg: 'success', title: '下单成功！'});
        }

    });
    // 白名单随机获取账号
    router.get("/lazada/users", function (req, res) {
        // 随机返回一个账号
        let index = Math.floor((Math.random() * whiteList.length));
        logger.info('随机获取的账号: ' + JSON.stringify(whiteList[index]));
        res.json({
            status: 200,
            msg: 'success',
            data: whiteList[index]
        })
    });
};


