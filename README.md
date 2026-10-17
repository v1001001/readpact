# ReadPact · 读书押金挑战

<p align="center">
  <img src="docs/readpact/design/readpact-cover.jpg" alt="文化赌徒：赌这次，我真的能把这本书读完" width="470">
</p>

Monad Blitz 参赛源码快照。

演示：https://staff.dushu365.com/readpact/

以 10 测试 MON 押金与两位同伴见证，帮助读者在 21 天完成 18 天共读。至少三人成组，多书籍独立挑战与同书基金。

## 项目结构

- front：React / TypeScript 前端
- back：Spring Boot / MyBatis / Flyway 书目与阅读服务
- contracts：Solidity 合约与测试
- deployments：测试网部署及验证记录

公开快照不包含本地钱包、部署凭据、内部运维文档或私有 Git 历史。运行真实签名接口需要自行配置后端签名账户；切勿使用真实资产。当前 8 本书统一使用真实测试网押金流程；历史截图中的模拟界面仅为之前的演示记录。

## 本地运行

Java 21、Maven、Node.js 20。后端：`cd back && mvn spring-boot:run`；前端：`cd front && npm ci && npm run dev`。部署所需配置请使用环境变量自行设置。

## 最新演示截图

![书架与进度](docs/readpact/design/database-demo-home.png)

![打卡完成](docs/readpact/design/database-demo-complete.png)

![小组列表](docs/readpact/design/group-list-cached.png)

## 最新支付流程

全部书籍使用 Monad Testnet 真实押金流程，新增本机支付回执记录。详见 [支付说明](docs/readpact/REAL-PAYMENTS.md)。

![本机扣款记录](docs/readpact/design/payment-history.png)
