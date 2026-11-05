/**
 * 产品型号编制办法 数据字典（CJQW0106 B1 2023-11-30）
 *
 * 本文件由正式发布文件《CJQW0106 产品型号编制办法 B1-20231030.xlsx》
 * 逐条提取生成，忠实原文、未做任何修改。数据来源：
 *   附表1 顾客编码（77 条）
 *   附表2 车型代码（1254 条）
 *   附表3 产品类型代码技术特征代码（74 条）
 *   附表4 纯结构件技术特征代码作为种类区分（6 类产品类型）
 *   附表6 高新项目列表（77 条）
 *   附表7 机动总成编码汇总表（61 条）
 */

/** 顾客编码（附表1） */
export interface CustomerCode {
  code: string
  name: string
  short: string
  eng: string
  brand: string
}

/** 车型代码（附表2） */
export interface VehicleCode {
  host: string
  code: string
  name: string
}

/** 产品类型代码（附表3） */
export interface ProductTypeCode {
  code: string
  name: string
  alias: string
}

/** 纯结构件技术特征（附表4） */
export interface StructTypeBlock {
  typeCode: string
  typeName: string
  entries: { region: string; code: string; name: string }[]
}

/** 高新项目（附表6） */
export interface HitechProject {
  no: string
  name: string
}

/** 机动总成编码汇总（附表7） */
export interface AggCode {
  no: string
  code: string
  name: string
  date: string
  note: string
}

/** 顾客编码字典（附表1，77 条，忠实原文） */
export const CUSTOMER_CODES: CustomerCode[] = [
{
"code": "0A",
"name": "中国第一汽车集团有限公司(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)",
"short": "一汽集团",
"eng": "FAW",
"brand": "红旗-L6/H6/H7/H9/E-HS9/E-HS3/HS6/HS7、奔腾-B70/B30/B60/T33/X40/T77/X80/E01/T99、解放T80/T90、蓝舰、森雅、佳宝、坤程"
},
{
"code": "0B",
"name": "一汽大众汽车有限公司",
"short": "一汽大众",
"eng": "FVW",
"brand": "宝来、高尔夫、速腾、C-TREK蔚领、迈腾、CC、奥迪Q2L/Q3/Q6/Q6L/A3/A4L/A6/A6L"
},
{
"code": "0C",
"name": "奇瑞汽车股份有限公司(芜湖奇瑞、上海奇瑞、集瑞重工)",
"short": "奇瑞汽车",
"eng": "CHERY/CTCS",
"brand": "瑞虎-8 PLUS/3/3x/6x/7/8/3xe/E、艾瑞泽-6/GX/6E/E、奇瑞eQ1、奇瑞蚂蚁"
},
{
"code": "0D",
"name": "上汽大众汽车有限公司",
"short": "上汽大众",
"eng": "SVW",
"brand": "途观X、途铠、途岳、途观L、途昂、途昂X、Polo、桑塔纳、朗逸、凌渡、帕萨特、辉昂、途安、威然"
},
{
"code": "0E",
"name": "重庆长安汽车股份有限公司",
"short": "长安汽车",
"eng": "CCAG",
"brand": "奔奔、悦翔、逸动、锐城CC、CS16、CS36、CS66、CS76、CS86、CS96、UNI-T、欧尚-X6/科赛3/科赛6/X7/CX70/A699/A800、长行、科尚、尼欧Ⅱ"
},
{
"code": "0F",
"name": "广州汽车集团汽车股份有限公司(广汽乘用车)",
"short": "广汽集团",
"eng": "GAG",
"brand": "传祺-GA6/GA8/GA4/GS3/GS4/GS6/GS8/M6/M8、Aion S、传祺GE3、Aion Ⅴ、Aion LX"
},
{
"code": "0G",
"name": "Volkswagen AG(德国大众)/德国奥迪/巴西大众",
"short": "德国大众/德国奥迪/海外大众",
"eng": "VW/Audi",
"brand": "Audi-A3/A4/A6/A6/A7/A8/S3/S4/S6/S6/S7/S8/Q7/Q8\n/A6/A6/SQ6/TT/TTS、大众-高尔夫/蔚揽/大众/途锐/UpPassat/Tiguan/夏朗/迈特威/凯路威"
},
{
"code": "0H",
"name": "哈飞汽车股份有限公司",
"short": "哈飞汽车",
"eng": "",
"brand": "哈飞、骏意、民意、中意"
},
{
"code": "0K",
"name": "北京汽车集团有限公司(北京汽车、北汽银翔、北汽福田、北汽越野)",
"short": "北汽集团",
"eng": "BAIC",
"brand": "绅宝、幻速、威旺、路霸、锐铃、勇士、越铃、战旗"
},
{
"code": "0L",
"name": "浙江吉利控股集团有限公司",
"short": "吉利汽车",
"eng": "GEELY",
"brand": "缤瑞、博瑞、博越、帝豪、金刚、远景"
},
{
"code": "0M",
"name": "上海汽车集团股份有限公司(上汽乘用车)",
"short": "上汽集团",
"eng": "SAIC",
"brand": "荣威、名爵、锐腾、锐行"
},
{
"code": "0N",
"name": "北京现代汽车有限公司",
"short": "北京现代",
"eng": "HNDAIYU",
"brand": "伊兰特、瑞纳、悦纳、悦动、菲斯塔、领动、逸行、名图、索纳塔、ENCINO、ix26、途胜、ix36、胜达"
},
{
"code": "0P",
"name": "长城汽车股份有限公司",
"short": "长城汽车",
"eng": "GWM",
"brand": "长城、风骏、哈弗、炮"
},
{
"code": "0Q",
"name": "北京长城华冠汽车科技股份有限公司",
"short": "长城华冠",
"eng": "CHA",
"brand": ""
},
{
"code": "0R",
"name": "汽车零件部件厂商(二次配套)",
"short": "",
"eng": "TIER",
"brand": "株洲欧格瑞、华创、明宇、星宇、海拉、延锋智能等"
},
{
"code": "0S",
"name": "SEAT, S.A.(西雅特)",
"short": "西雅特",
"eng": "SEAT",
"brand": "LEON、欧悦博、伊比飒"
},
{
"code": "0T",
"name": "重庆力帆控股有限公司(力帆汽车、力帆新能源)",
"short": "重庆力帆",
"eng": "LIFAN",
"brand": "丰顺、福顺、乐途、力帆、迈威、兴顺、轩朗"
},
{
"code": "0U",
"name": "比亚迪股份有限公司",
"short": "比亚迪",
"eng": "BYD",
"brand": "比亚迪、秦、宋、唐、元、速锐"
},
{
"code": "0V",
"name": "中国青年汽车集团",
"short": "青年汽车",
"eng": "",
"brand": "尼奥普兰、曼卡、莲花"
},
{
"code": "0W",
"name": "安徽江淮汽车集团股份有限公司(江淮轿车)",
"short": "江淮汽车",
"eng": "JAC",
"brand": "江淮、凌玲、瑞风、帅铃、星锐"
},
{
"code": "0X",
"name": "待定",
"short": "",
"eng": "",
"brand": ""
},
{
"code": "0Y",
"name": "General Motors LLC/GM Holden Ltd./GM INDIA Ltd./GM Korea Company/General Motors do Brasil LTDA/上汽通用汽车有限公司",
"short": "通用全球/上汽通用",
"eng": "GM/SGM",
"brand": "别克、雪佛兰、凯迪拉克、GMC"
},
{
"code": "0Z",
"name": "郑州日产汽车有限公司",
"short": "郑州日产",
"eng": "NISSAN",
"brand": "纳瓦拉、日产、途达"
},
{
"code": "ES",
"name": "长江汽车前瞻性产品（原型项目）",
"short": "浙江长江",
"eng": "CAEA",
"brand": "-"
},
{
"code": "AA",
"name": "奇瑞捷豹路虎汽车有限公司",
"short": "奇瑞捷豹陆虎",
"eng": "CJLR",
"brand": "捷豹-XEL/XFL/E-PACE、发现运动版、揽胜极光"
},
{
"code": "AB",
"name": "上海蔚来汽车有限公司",
"short": "蔚来汽车",
"eng": "NIO",
"brand": "ES6、ES7、ES8、ET6、ET7、EC6、EC7"
},
{
"code": "AC",
"name": "北京宝沃汽车有限公司",
"short": "宝沃汽车",
"eng": "BORGWARD",
"brand": "BX6、BX6、BX7、BXi7"
},
{
"code": "AD",
"name": "上汽大通汽车有限公司",
"short": "上汽大通",
"eng": "MAXUS",
"brand": "RG20、EG10、G60、G10、G20、RG10、D60、D90、EV30、EV90、RV80、V80、V90、T60、T70、EUNIQ 6"
},
{
"code": "AE",
"name": "东风小康汽车有限公司",
"short": "东风小康",
"eng": "DFSK",
"brand": "C31、C32、C36、C37、D61、D62、EC36、K01、K02、K06S、K07S"
},
{
"code": "AF",
"name": "观致汽车有限公司",
"short": "观致汽车",
"eng": "QOROS",
"brand": "观致3、观致6、观致7"
},
{
"code": "AG",
"name": "斯柯达(SKODA)",
"short": "斯柯达",
"eng": "SKODA",
"brand": "明锐、昕动、昕锐、速派、柯米克、柯珞克、柯迪亚克、柯迪亚克GT"
},
{
"code": "AH",
"name": "重庆理想汽车有限公司",
"short": "理想汽车",
"eng": "LI",
"brand": "理想ONE、理想L7、理想L8、理想L9"
},
{
"code": "AK",
"name": "大乘汽车有限公司",
"short": "大乘汽车",
"eng": "DORCEN",
"brand": "大乘G60、大乘G60S"
},
{
"code": "AL",
"name": "爱驰汽车有限公司",
"short": "爱驰亿维",
"eng": "AIWAYS",
"brand": "爱驰U6"
},
{
"code": "AM",
"name": "江苏悦达起亚汽车有限公司",
"short": "悦达起亚",
"eng": "DYK",
"brand": "KX CROSS、焕驰、起亚K2、福瑞迪、起亚K3、K6凯酷、凯绅、KX3傲跑、奕跑、起亚KX6、智跑、起亚KX7"
},
{
"code": "AN",
"name": "广州小鹏汽车科技有限公司",
"short": "小鹏汽车",
"eng": "XPENG",
"brand": "G3、P7"
},
{
"code": "AP",
"name": "长安福特汽车有限公司",
"short": "长安福特",
"eng": "FORD",
"brand": "福克斯、福睿斯、金牛座、蒙迪欧、锐际、翼虎、锐界、探险者"
},
{
"code": "AQ",
"name": "南京博郡新能源汽车有限公司",
"short": "博郡汽车",
"eng": "BORDRIN",
"brand": ""
},
{
"code": "AR",
"name": "广汽丰田汽车有限公司",
"short": "广汽丰田",
"eng": "TOYOTA",
"brand": "YARiS L 致享、YARiS L 致炫、丰田C-HR、汉兰达、凯美瑞、雷凌、逸致、威兰达"
},
{
"code": "AS",
"name": "Volvo Car Corporation(沃尔沃汽车)",
"short": "沃尔沃",
"eng": "VOLVO",
"brand": "S60L、S90、XC60、V40、V60、V90、XC40、XC90"
},
{
"code": "AT",
"name": "宜宾凯翼汽车有限公司",
"short": "凯翼汽车",
"eng": "COWIN",
"brand": "凯翼E3、凯翼E6、凯翼X3、凯翼X6、炫界、凯翼昆仑、轩度、凯翼V7"
},
{
"code": "AU",
"name": "赛力斯汽车有限公司",
"short": "赛力斯",
"eng": "SERES",
"brand": "问界M6、M7"
},
{
"code": "AW",
"name": "华人运通技术有限公司",
"short": "华人运通",
"eng": "HHT",
"brand": "HiPhi X、HiPhi Z"
},
{
"code": "AX",
"name": "江铃汽车股份有限公司",
"short": "江铃汽车",
"eng": "JMC",
"brand": "全顺、途睿欧、撼路者、领界、凯锐、凯运、顺达、域虎、特顺、威龙、驭胜"
},
{
"code": "AY",
"name": "东风汽车集团股份有限公司乘用车公司",
"short": "东风乘用车",
"eng": "DFPV",
"brand": "俊风E11K、猛士M60、御风P16"
},
{
"code": "AZ",
"name": "韩国现代汽车有限公司",
"short": "韩国现代",
"eng": "HYUNDAI",
"brand": "帕里斯帝、途胜、胜达、Veloster、飞思、索纳塔、雅尊"
},
{
"code": "BA",
"name": "岚图汽车科技有限公司",
"short": "岚图汽车",
"eng": "DFG",
"brand": "岚图追光、岚图FREE、梦想家"
},
{
"code": "BB",
"name": "广汽本田汽车有限公司",
"short": "广汽本田",
"eng": "HNODA",
"brand": "飞度、凌派、雅阁、缤智、皓影、冠道、奥德赛"
},
{
"code": "BC",
"name": "广汽三菱汽车有限公司",
"short": "广汽三菱",
"eng": "GMMC",
"brand": "劲炫ASX、欧蓝德、奕歌"
},
{
"code": "BD",
"name": "戴姆勒股份公司",
"short": "戴姆勒",
"eng": "Daim",
"brand": "奔驰"
},
{
"code": "BE",
"name": "广州宝能汽车有限公司",
"short": "宝能汽车",
"eng": "BaoNeng",
"brand": ""
},
{
"code": "BF",
"name": "特斯拉（Tesla, Inc.）",
"short": "特斯拉",
"eng": "Tesla",
"brand": "Model S、Model 3、Model X、Model Y、Cybertruck、Roadster"
},
{
"code": "BG",
"name": "Jaguar Land Rover Limited",
"short": "捷豹路虎全球",
"eng": "JLR",
"brand": "F-pace、E-pace、I-pace、F-type、XEL、XFL、路虎揽胜、路虎发现、路虎卫士"
},
{
"code": "BH",
"name": "广汽菲亚特克莱斯勒汽车有限公司",
"short": "广汽菲克",
"eng": "FCA",
"brand": "菲亚特600"
},
{
"code": "BK",
"name": "Stellantis Group",
"short": "Stellantis",
"eng": "STEL",
"brand": "标致408、标致608、标致2008、标致4008、标致6008"
},
{
"code": "BL",
"name": "北京小桔智能汽车科技有限公司",
"short": "北京小桔",
"eng": "Alita",
"brand": ""
},
{
"code": "BM",
"name": "合创汽车科技有限公司",
"short": "合创汽车",
"eng": "HYCAN",
"brand": "A06、Z03、007、V09"
},
{
"code": "BN",
"name": "智己汽车科技有限公司",
"short": "智己汽车",
"eng": "Immotors",
"brand": "智己LS7、智己L7"
},
{
"code": "BP",
"name": "大众汽车(安徽)有限公司",
"short": "安徽大众",
"eng": "AHVW",
"brand": "Tarvascan"
},
{
"code": "BQ",
"name": "广汽埃安新能源汽车股份有限公司",
"short": "广汽埃安",
"eng": "GACNE",
"brand": "Hyper SSR、AION S、AION S Plus、AION V、AION Y、AION LX"
},
{
"code": "BR",
"name": "北京北汽李尔汽车系统有限公司",
"short": "李尔汽车",
"eng": "LEAR",
"brand": ""
},
{
"code": "BS",
"name": "集度汽车有限公司",
"short": "集度汽车",
"eng": "JIDU",
"brand": "ROBO-01"
},
{
"code": "BT",
"name": "东风本田汽车有限公司",
"short": "东风本田",
"eng": "HONDA",
"brand": "HR-V、NS1、XR-V、CR-V、UR-V、LIFE、思域、享域、英仕派、艾力绅"
},
{
"code": "BU",
"name": "奇瑞新能源汽车股份有限公司",
"short": "奇瑞新能源",
"eng": "CHERYEV",
"brand": "QQ冰淇淋、奇瑞无界Pro、小蚂蚁、艾瑞泽e、大蚂蚁"
},
{
"code": "BV",
"name": "北京新能源汽车股份有限公司",
"short": "北汽新能源",
"eng": "BJEV",
"brand": "极狐 αT6、极狐 αT、极狐考拉、极狐 αS\n北京X7、北京EU7"
},
{
"code": "BW",
"name": "合众新能源汽车有限公司",
"short": "合众新能源",
"eng": "HOZON",
"brand": "哪吒E、哪吒S、哪吒V、哪吒U"
},
{
"code": "BX",
"name": "智马达汽车有限公司",
"short": "智马达",
"eng": "SMART",
"brand": "精灵#3、精灵#1"
},
{
"code": "BY",
"name": "上海君趣汽车科技有限公司",
"short": "君趣汽车",
"eng": "QUNQ",
"brand": ""
},
{
"code": "BZ",
"name": "阿波罗智能科技(北京)有限公司",
"short": "百度阿波罗",
"eng": "APOLL",
"brand": "RT6"
},
{
"code": "CA",
"name": "浙江零跑科技股份有限公司",
"short": "零跑汽车",
"eng": "LEAP",
"brand": "T03、C11、S01、C01"
},
{
"code": "CB",
"name": "上海吉祥智驱新能源汽车有限公司",
"short": "吉祥汽车",
"eng": "JXEV",
"brand": ""
},
{
"code": "CC",
"name": "北京汽车制造厂（青岛）有限公司",
"short": "青岛北汽制造厂",
"eng": "BAW",
"brand": ""
},
{
"code": "CD",
"name": "Porsche AG",
"short": "保时捷",
"eng": "PORS",
"brand": ""
},
{
"code": "CE",
"name": "飞凡汽车科技有限公司",
"short": "飞凡汽车",
"eng": "RISING AUTO",
"brand": ""
},
{
"code": "CF",
"name": "浙江极氪汽车研究开发有限公司",
"short": "极氪汽车",
"eng": "ZEEKR",
"brand": ""
},
{
"code": "CG",
"name": "奥迪一汽新能源有限公司",
"short": "奥迪一汽PPE",
"eng": "PPE",
"brand": ""
},
{
"code": "CH",
"name": "南京依维柯有限公司",
"short": "南京依维柯",
"eng": "IVECO",
"brand": ""
}
]

/** 车型代码字典（附表2，1254 条，忠实原文） */
export const VEHICLE_CODES: VehicleCode[] = [
{
"host": "ES(此处所列车型为目标车型，非量产车型）",
"code": "0A",
"name": "上汽通用A8L"
},
{
"host": "ES(此处所列车型为目标车型，非量产车型）",
"code": "0B",
"name": "吉利 DC1F"
},
{
"host": "ES(此处所列车型为目标车型，非量产车型）",
"code": "0C",
"name": "上汽大通 MIFA(原型件）"
},
{
"host": "ES(此处所列车型为目标车型，非量产车型）",
"code": "0D",
"name": "大众系"
},
{
"host": "ES(此处所列车型为目标车型，非量产车型）",
"code": "0E",
"name": "SGM 557(原型件）"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0A",
"name": "M6"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1A",
"name": "N501"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "2A",
"name": "C094/C094-01"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0B",
"name": "C302/C302-09/C302-20"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1B",
"name": "B70FL"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "2B",
"name": "C001"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0C",
"name": "A501/B50"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1C",
"name": "D058"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "2C",
"name": "T77"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0D",
"name": "C302/C302高配"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1D",
"name": "红旗T266"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "2D",
"name": "D711"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0E",
"name": "A130"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1E",
"name": "红旗 HS7"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "2E",
"name": "A01"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0F",
"name": "C303(奔腾B90)"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1F",
"name": "红旗EV"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "2F",
"name": "C891-02"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0G",
"name": "D003"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1G",
"name": "D077/D077-CO"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "2G",
"name": "C919"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0H",
"name": "D009"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1H",
"name": "HS5"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "2H",
"name": "0226"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0K",
"name": "卡车A01/J6"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1K",
"name": "T196"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "2K",
"name": "E702"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0L",
"name": "B50F"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1L",
"name": "C018"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0M",
"name": "J71R马自达"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1M",
"name": "D092"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0N",
"name": "D021"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1N",
"name": "X40FL"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0P",
"name": "B50F混合动力"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1P",
"name": "红旗HQE320"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0Q",
"name": "红旗HQE"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1Q",
"name": "红旗H7换代/C229-01/C891"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0R",
"name": "欧朗纯电动"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1R",
"name": "C105 EV"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0S",
"name": "A0EV"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1S",
"name": "HS3"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0T",
"name": "D181"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1T",
"name": "E115/E115-01"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0U",
"name": "红旗P504"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1U",
"name": "D357"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0W",
"name": "X80F"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1W",
"name": "D365"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0X",
"name": "D090(红旗H5)/D093"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1X",
"name": "C095"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0Y",
"name": "红旗H7改款/ H7FL"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1Y",
"name": "C100"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "0Z",
"name": "T503"
},
{
"host": "一汽集团(一汽轿车股份、一汽新能源、一汽解放、一汽马自达、天津一汽夏利等)\n(0A)",
"code": "1Z",
"name": "红旗C206"
},
{
"host": "一汽大众(0B)",
"code": "0A",
"name": "Jetta(05/06/07/A2(改饰))/GOLF A6/上海大众 NMS、Jetta 纪念款"
},
{
"host": "一汽大众(0B)",
"code": "1A",
"name": "GOLF Sportsvan"
},
{
"host": "一汽大众(0B)",
"code": "2A",
"name": "Audi A SUVe"
},
{
"host": "一汽大众(0B)",
"code": "0B",
"name": "Audi(B6/B7)/GOLF A6"
},
{
"host": "一汽大众(0B)",
"code": "1B",
"name": "Bora MQB/NCS NF"
},
{
"host": "一汽大众(0B)",
"code": "2B",
"name": "Audi Q5"
},
{
"host": "一汽大众(0B)",
"code": "0C",
"name": "Audi C6/Audi B6"
},
{
"host": "一汽大众(0B)",
"code": "1C",
"name": "A-SUV/A SUV PHEV PA"
},
{
"host": "一汽大众(0B)",
"code": "2C",
"name": "B9"
},
{
"host": "一汽大众(0B)",
"code": "0D",
"name": "Caddy/上海大众途安"
},
{
"host": "一汽大众(0B)",
"code": "1D",
"name": "T-Roc/ MQB 37 T-ROC/T-ROC PA"
},
{
"host": "一汽大众(0B)",
"code": "2D",
"name": "A SUV NF"
},
{
"host": "一汽大众(0B)",
"code": "0E",
"name": "Bora A5(速腾)/上海大众途安/GOLF A5(速腾)"
},
{
"host": "一汽大众(0B)",
"code": "1E",
"name": "Sagitar NF(速腾NCS NF)"
},
{
"host": "一汽大众(0B)",
"code": "2E",
"name": "ID4"
},
{
"host": "一汽大众(0B)",
"code": "0F",
"name": "FUTURE B6"
},
{
"host": "一汽大众(0B)",
"code": "1F",
"name": "Q2"
},
{
"host": "一汽大众(0B)",
"code": "2F",
"name": "ID6"
},
{
"host": "一汽大众(0B)",
"code": "0G",
"name": "Model-X(New Bora/1.4T)/New Jetta/Bora GP"
},
{
"host": "一汽大众(0B)",
"code": "1G",
"name": "GOLF BEV"
},
{
"host": "一汽大众(0B)",
"code": "2G",
"name": "B SMV PA"
},
{
"host": "一汽大众(0B)",
"code": "0H",
"name": "Audi B8/B8PA"
},
{
"host": "一汽大众(0B)",
"code": "1H",
"name": "MQB A0(国产化)"
},
{
"host": "一汽大众(0B)",
"code": "2H",
"name": "奥迪B10"
},
{
"host": "一汽大众(0B)",
"code": "0K",
"name": "迈腾CC/迈腾B7L/CC FL/CC FB"
},
{
"host": "一汽大众(0B)",
"code": "1K",
"name": "Audi Q3 NF"
},
{
"host": "一汽大众(0B)",
"code": "2K",
"name": "NCS A8"
},
{
"host": "一汽大众(0B)",
"code": "0L",
"name": "SAGITAR-NCS/NCS GP"
},
{
"host": "一汽大众(0B)",
"code": "1L",
"name": "DY A SUV/BC311"
},
{
"host": "一汽大众(0B)",
"code": "0M",
"name": "GOLF A6(速腾)"
},
{
"host": "一汽大众(0B)",
"code": "1M",
"name": "T-CROSS"
},
{
"host": "一汽大众(0B)",
"code": "0N",
"name": "MAGOTAN-B7L"
},
{
"host": "一汽大众(0B)",
"code": "1N",
"name": "C-BEV"
},
{
"host": "一汽大众(0B)",
"code": "0P",
"name": "奥迪C7"
},
{
"host": "一汽大众(0B)",
"code": "1P",
"name": "MQB"
},
{
"host": "一汽大众(0B)",
"code": "0Q",
"name": "JETTA NF/JETTA GP"
},
{
"host": "一汽大众(0B)",
"code": "1Q",
"name": "A3NF"
},
{
"host": "一汽大众(0B)",
"code": "0R",
"name": "NEW BORA GP"
},
{
"host": "一汽大众(0B)",
"code": "1R",
"name": "Golf A8"
},
{
"host": "一汽大众(0B)",
"code": "0S",
"name": "AUDI X77(Q3)PA"
},
{
"host": "一汽大众(0B)",
"code": "1S",
"name": "CC SB/Golf a8/B-SMV/A SUVe/Lounge SUVe"
},
{
"host": "一汽大众(0B)",
"code": "0T",
"name": "GOLF A7/ GOLF A7 GP"
},
{
"host": "一汽大众(0B)",
"code": "1T",
"name": "BORA NF"
},
{
"host": "一汽大众(0B)",
"code": "1U",
"name": "ASUVE"
},
{
"host": "一汽大众(0B)",
"code": "0W",
"name": "Audi C7PA/Audi A6L/Q3PA"
},
{
"host": "一汽大众(0B)",
"code": "1W",
"name": "TBD（语音反馈的车型代码）"
},
{
"host": "一汽大众(0B)",
"code": "0X",
"name": "BORA NF"
},
{
"host": "一汽大众(0B)",
"code": "1X",
"name": "30C/B Main SUV"
},
{
"host": "一汽大众(0B)",
"code": "0Y",
"name": "迈腾NF(B8L)/B8L PHEV/B8L PA"
},
{
"host": "一汽大众(0B)",
"code": "1Y",
"name": "红旗 N117"
},
{
"host": "一汽大众(0B)",
"code": "0Z",
"name": "奥迪A4L/T88"
},
{
"host": "一汽大众(0B)",
"code": "1Z",
"name": "Aero B"
},
{
"host": "奇  瑞(0C)",
"code": "0A",
"name": "A15(A15-07)/A11/A18"
},
{
"host": "奇  瑞(0C)",
"code": "1A",
"name": "B21/B21新内饰"
},
{
"host": "奇  瑞(0C)",
"code": "2A",
"name": "S18电动车"
},
{
"host": "奇  瑞(0C)",
"code": "3A",
"name": "M1AFL2"
},
{
"host": "奇  瑞(0C)",
"code": "4A",
"name": "T26/8AT"
},
{
"host": "奇  瑞(0C)",
"code": "5A",
"name": "M1AFL2 2022款"
},
{
"host": "奇  瑞(0C)",
"code": "6A",
"name": "M1AFL2中亚"
},
{
"host": "奇  瑞(0C)",
"code": "0B",
"name": "B11(08/CNG/降价/改型/改内饰)/A15-07"
},
{
"host": "奇  瑞(0C)",
"code": "1B",
"name": "L41/L41AA"
},
{
"host": "奇  瑞(0C)",
"code": "2B",
"name": "A3 Ⅱ右舵"
},
{
"host": "奇  瑞(0C)",
"code": "3B",
"name": "M36T(上海奇瑞)、M36T-2.0/M36T MY/M32TFL/M36T 俄罗斯/M32TFL MY2"
},
{
"host": "奇  瑞(0C)",
"code": "4B",
"name": "T1C MY2"
},
{
"host": "奇  瑞(0C)",
"code": "5B",
"name": "M1DFL2 2022款"
},
{
"host": "奇  瑞(0C)",
"code": "6B",
"name": "T28"
},
{
"host": "奇  瑞(0C)",
"code": "0C",
"name": "T11(08/AM7/欧盟/降价/出口/右舵)"
},
{
"host": "奇  瑞(0C)",
"code": "1C",
"name": "S21改型"
},
{
"host": "奇  瑞(0C)",
"code": "2C",
"name": "S15 EV(电动车)/S51EV年型车"
},
{
"host": "奇  瑞(0C)",
"code": "3C",
"name": "S11EV"
},
{
"host": "奇  瑞(0C)",
"code": "4C",
"name": "T22"
},
{
"host": "奇  瑞(0C)",
"code": "5C",
"name": "M1AFL2出租车"
},
{
"host": "奇  瑞(0C)",
"code": "6C",
"name": "瑞虎8PRO"
},
{
"host": "奇  瑞(0C)",
"code": "0D",
"name": "A21(08/HEV/FACELIFT/降价/右舵/改内饰/欧盟)/A21F1"
},
{
"host": "奇  瑞(0C)",
"code": "1D",
"name": "B16"
},
{
"host": "奇  瑞(0C)",
"code": "2D",
"name": "S15-14款(QQ)"
},
{
"host": "奇  瑞(0C)",
"code": "3D",
"name": "M32T(上海奇瑞)/M32T FL/M32TPLUS/M32T FL 2,0T/M32T国际版/M32T FL 国际版/M32T FL/M32T FL MY"
},
{
"host": "奇  瑞(0C)",
"code": "4D",
"name": "T1CFL"
},
{
"host": "奇  瑞(0C)",
"code": "5D",
"name": "T1EJ"
},
{
"host": "奇  瑞(0C)",
"code": "6D",
"name": "T1E四驱俄罗斯"
},
{
"host": "奇  瑞(0C)",
"code": "0E",
"name": "B14(08/智利)"
},
{
"host": "奇  瑞(0C)",
"code": "1E",
"name": "S15"
},
{
"host": "奇  瑞(0C)",
"code": "2E",
"name": "T21-14(14款)"
},
{
"host": "奇  瑞(0C)",
"code": "3E",
"name": "T15FL2"
},
{
"host": "奇  瑞(0C)",
"code": "4E",
"name": "A13TA-2"
},
{
"host": "奇  瑞(0C)",
"code": "5E",
"name": "T18国际"
},
{
"host": "奇  瑞(0C)",
"code": "6E",
"name": "T18FL4"
},
{
"host": "奇  瑞(0C)",
"code": "0F",
"name": "S12(降价/俄罗斯/欧盟)"
},
{
"host": "奇  瑞(0C)",
"code": "1F",
"name": "S12FL"
},
{
"host": "奇  瑞(0C)",
"code": "2F",
"name": "T15"
},
{
"host": "奇  瑞(0C)",
"code": "3F",
"name": "T1A/T1D/T1D PHEV/T1E/T1E国际/T1A俄罗斯/T1A国际/T1D 国际/ T1D 2.0T/T1A年型车/T1EFL1/T1D国际/T1D右舵/T1D年型车/T1A东北版/T1D PHEV巴西"
},
{
"host": "奇  瑞(0C)",
"code": "4F",
"name": "(原T15FL)T1C/T1C年型车/T1C国际"
},
{
"host": "奇  瑞(0C)",
"code": "5F",
"name": "M32TFL2"
},
{
"host": "奇  瑞(0C)",
"code": "6F",
"name": "EHY"
},
{
"host": "奇  瑞(0C)",
"code": "0G",
"name": "S21(降价/俄罗斯改内饰)"
},
{
"host": "奇  瑞(0C)",
"code": "1G",
"name": "A01/A01A"
},
{
"host": "奇  瑞(0C)",
"code": "2G",
"name": "T17"
},
{
"host": "奇  瑞(0C)",
"code": "3G",
"name": "L41"
},
{
"host": "奇  瑞(0C)",
"code": "4G",
"name": "M31TFL&M36TFL"
},
{
"host": "奇  瑞(0C)",
"code": "5G",
"name": "T1E 2022MY"
},
{
"host": "奇  瑞(0C)",
"code": "6G",
"name": "T22PHEV/T1EJPHEV"
},
{
"host": "奇  瑞(0C)",
"code": "0H",
"name": "S22/S22L"
},
{
"host": "奇  瑞(0C)",
"code": "1H",
"name": "T11 Facelift/T11-13/T11FL3（国六）/T11FL2"
},
{
"host": "奇  瑞(0C)",
"code": "2H",
"name": "A16"
},
{
"host": "奇  瑞(0C)",
"code": "3H",
"name": "H16EV 2EMT"
},
{
"host": "奇  瑞(0C)",
"code": "4H",
"name": "T1E22款年型车"
},
{
"host": "奇  瑞(0C)",
"code": "5H",
"name": "T1E国内PHEV"
},
{
"host": "奇  瑞(0C)",
"code": "6H",
"name": "T19FL澳新"
},
{
"host": "奇  瑞(0C)",
"code": "0K",
"name": "A15(477F/07/甲醇项目/降价/俄罗斯/出租车)"
},
{
"host": "奇  瑞(0C)",
"code": "1K",
"name": "T21/T21FL/T21FL年型车"
},
{
"host": "奇  瑞(0C)",
"code": "2K",
"name": "H6(电动车)"
},
{
"host": "奇  瑞(0C)",
"code": "3K",
"name": "T18(国际）"
},
{
"host": "奇  瑞(0C)",
"code": "4K",
"name": "T18P/T18P RDE"
},
{
"host": "奇  瑞(0C)",
"code": "5K",
"name": "E03/E0Y"
},
{
"host": "奇  瑞(0C)",
"code": "0L",
"name": "B13"
},
{
"host": "奇  瑞(0C)",
"code": "1L",
"name": "B15"
},
{
"host": "奇  瑞(0C)",
"code": "2L",
"name": "CC2S/M31T(上海奇瑞研发)/M31TMY2"
},
{
"host": "奇  瑞(0C)",
"code": "3L",
"name": "T19(国际）"
},
{
"host": "奇  瑞(0C)",
"code": "4L",
"name": "M36TFL1"
},
{
"host": "奇  瑞(0C)",
"code": "5L",
"name": "T1D PHEV 2022"
},
{
"host": "奇  瑞(0C)",
"code": "0M",
"name": "M11(07/降价/银灰色内室/右舵)"
},
{
"host": "奇  瑞(0C)",
"code": "1M",
"name": "B25"
},
{
"host": "奇  瑞(0C)",
"code": "2M",
"name": "S51 EV(电动车)"
},
{
"host": "奇  瑞(0C)",
"code": "3M",
"name": "M1AEV-MY2/M1AEV"
},
{
"host": "奇  瑞(0C)",
"code": "4M",
"name": "S51EV2023款"
},
{
"host": "奇  瑞(0C)",
"code": "5M",
"name": "T1D PHEV国际"
},
{
"host": "奇  瑞(0C)",
"code": "0N",
"name": "S16"
},
{
"host": "奇  瑞(0C)",
"code": "1N",
"name": "M16/M16FL"
},
{
"host": "奇  瑞(0C)",
"code": "2N",
"name": "T15年型车"
},
{
"host": "奇  瑞(0C)",
"code": "3N",
"name": "T19 EV/T19EV FL"
},
{
"host": "奇  瑞(0C)",
"code": "4N",
"name": "T1E俄罗斯"
},
{
"host": "奇  瑞(0C)",
"code": "5N",
"name": "T19CEV"
},
{
"host": "奇  瑞(0C)",
"code": "0P",
"name": "P11"
},
{
"host": "奇  瑞(0C)",
"code": "1P",
"name": "A21FL-C"
},
{
"host": "奇  瑞(0C)",
"code": "2P",
"name": "T11FL3年型车（伊朗)"
},
{
"host": "奇  瑞(0C)",
"code": "3P",
"name": "XC51"
},
{
"host": "奇  瑞(0C)",
"code": "4P",
"name": "M32TFL1"
},
{
"host": "奇  瑞(0C)",
"code": "5P",
"name": "T22 PHEV国际"
},
{
"host": "奇  瑞(0C)",
"code": "0Q",
"name": "Q21"
},
{
"host": "奇  瑞(0C)",
"code": "1Q",
"name": "A15FL-C"
},
{
"host": "奇  瑞(0C)",
"code": "2Q",
"name": "A13TEV"
},
{
"host": "奇  瑞(0C)",
"code": "3Q",
"name": "S61EV新能源"
},
{
"host": "奇  瑞(0C)",
"code": "4Q",
"name": "T18FL3 PHEV"
},
{
"host": "奇  瑞(0C)",
"code": "5Q",
"name": "M32T FL2"
},
{
"host": "奇  瑞(0C)",
"code": "0R",
"name": "B23"
},
{
"host": "奇  瑞(0C)",
"code": "1R",
"name": "B11FL-C"
},
{
"host": "奇  瑞(0C)",
"code": "2R",
"name": "M1D"
},
{
"host": "奇  瑞(0C)",
"code": "3R",
"name": "T19FL/T19FL右舵/T19FL1/T19FL国际"
},
{
"host": "奇  瑞(0C)",
"code": "4R",
"name": "T18FL3右舵"
},
{
"host": "奇  瑞(0C)",
"code": "5R",
"name": "T22 国际"
},
{
"host": "奇  瑞(0C)",
"code": "0S",
"name": "S18(A/B/C/D/E/F/472MT)"
},
{
"host": "奇  瑞(0C)",
"code": "1S",
"name": "T1"
},
{
"host": "奇  瑞(0C)",
"code": "2S",
"name": "T18"
},
{
"host": "奇  瑞(0C)",
"code": "3S",
"name": "M1DFL2/M1DFL2国际/M1DFL3"
},
{
"host": "奇  瑞(0C)",
"code": "4S",
"name": "A13TFL-2"
},
{
"host": "奇  瑞(0C)",
"code": "5S",
"name": "EH3"
},
{
"host": "奇  瑞(0C)",
"code": "0T",
"name": "H13(SQR6540EV纯电动客车/简配)"
},
{
"host": "奇  瑞(0C)",
"code": "1T",
"name": "H13右舵"
},
{
"host": "奇  瑞(0C)",
"code": "2T",
"name": "T15Q"
},
{
"host": "奇  瑞(0C)",
"code": "3T",
"name": "A13TEV FL"
},
{
"host": "奇  瑞(0C)",
"code": "4T",
"name": "T19C国际"
},
{
"host": "奇  瑞(0C)",
"code": "5T",
"name": "T18P PHEV"
},
{
"host": "奇  瑞(0C)",
"code": "0U",
"name": "M14"
},
{
"host": "奇  瑞(0C)",
"code": "1U",
"name": "S3"
},
{
"host": "奇  瑞(0C)",
"code": "2U",
"name": "M1AEV//M1A/M1A巴西/M1A国际"
},
{
"host": "奇  瑞(0C)",
"code": "3U",
"name": "T19C/T19C右舵/T19C RDE"
},
{
"host": "奇  瑞(0C)",
"code": "4U",
"name": "M1AFL2 埃及"
},
{
"host": "奇  瑞(0C)",
"code": "5U",
"name": "T1E 23MY"
},
{
"host": "奇  瑞(0C)",
"code": "0W",
"name": "B12"
},
{
"host": "奇  瑞(0C)",
"code": "1W",
"name": "M19"
},
{
"host": "奇  瑞(0C)",
"code": "2W",
"name": "M1DEV"
},
{
"host": "奇  瑞(0C)",
"code": "3W",
"name": "T1C PHEV"
},
{
"host": "奇  瑞(0C)",
"code": "4W",
"name": "M1E国际"
},
{
"host": "奇  瑞(0C)",
"code": "5W",
"name": "M1E PHEV"
},
{
"host": "奇  瑞(0C)",
"code": "0X",
"name": "B22"
},
{
"host": "奇  瑞(0C)",
"code": "1X",
"name": "A19/A19FL"
},
{
"host": "奇  瑞(0C)",
"code": "2X",
"name": "T19"
},
{
"host": "奇  瑞(0C)",
"code": "3X",
"name": "T18FL3/T1E/T1EJ/T19FL欧盟 燃油车"
},
{
"host": "奇  瑞(0C)",
"code": "4X",
"name": "M1DFL2年型车RDE"
},
{
"host": "奇  瑞(0C)",
"code": "5X",
"name": "T26 国际"
},
{
"host": "奇  瑞(0C)",
"code": "0Y",
"name": "A13C"
},
{
"host": "奇  瑞(0C)",
"code": "1Y",
"name": "B14FL"
},
{
"host": "奇  瑞(0C)",
"code": "2Y",
"name": "T15EV"
},
{
"host": "奇  瑞(0C)",
"code": "3Y",
"name": "T1EFL1国际"
},
{
"host": "奇  瑞(0C)",
"code": "5Y",
"name": "T22 右舵"
},
{
"host": "奇  瑞(0C)",
"code": "0Z",
"name": "L11/L12"
},
{
"host": "奇  瑞(0C)",
"code": "1Z",
"name": "A13FL/A13FL国际/A13TFL/A13TFL2/A13TFL2国际"
},
{
"host": "奇  瑞(0C)",
"code": "2Z",
"name": "M1AEVFL"
},
{
"host": "奇  瑞(0C)",
"code": "3Z",
"name": "M1E"
},
{
"host": "奇  瑞(0C)",
"code": "4Z",
"name": "M1DFL2 中亚"
},
{
"host": "奇  瑞(0C)",
"code": "5Z",
"name": "T28 PHEV"
},
{
"host": "上汽大众(0D)",
"code": "0A",
"name": "帕萨特B5"
},
{
"host": "上汽大众(0D)",
"code": "1A",
"name": "Super B NF"
},
{
"host": "上汽大众(0D)",
"code": "2A",
"name": "AUDI A5L"
},
{
"host": "上汽大众(0D)",
"code": "0B",
"name": "帕萨特(B5GP/08/FACELIFT)"
},
{
"host": "上汽大众(0D)",
"code": "1B",
"name": "VW511/C Modell PA"
},
{
"host": "上汽大众(0D)",
"code": "0C",
"name": "途安/途安NF"
},
{
"host": "上汽大众(0D)",
"code": "1C",
"name": "B-SUV\n(NMS NF)"
},
{
"host": "上汽大众(0D)",
"code": "0D",
"name": "MODEL X(MP08/FL)/Octavia FL/Octavia GL2"
},
{
"host": "上汽大众(0D)",
"code": "1D",
"name": "A+ SUV(Yeti NF)"
},
{
"host": "上汽大众(0D)",
"code": "0E",
"name": "MODEL Y(F/1.4TSI)"
},
{
"host": "上汽大众(0D)",
"code": "1E",
"name": "CUV"
},
{
"host": "上汽大众(0D)",
"code": "0F",
"name": "MODEL Y/F"
},
{
"host": "上汽大众(0D)",
"code": "1F",
"name": "T-CROSS"
},
{
"host": "上汽大众(0D)",
"code": "0G",
"name": "POLO"
},
{
"host": "上汽大众(0D)",
"code": "1G",
"name": "VW418 B-MPV"
},
{
"host": "上汽大众(0D)",
"code": "0H",
"name": "SANTANA3000"
},
{
"host": "上汽大众(0D)",
"code": "1H",
"name": "MEB"
},
{
"host": "上汽大众(0D)",
"code": "0K",
"name": "MODELL S"
},
{
"host": "上汽大众(0D)",
"code": "1K",
"name": "A SUVe/Lounge SUVe"
},
{
"host": "上汽大众(0D)",
"code": "0L",
"name": "A-entry/Santana NF(SK253CS)"
},
{
"host": "上汽大众(0D)",
"code": "1L",
"name": "Audi A7L"
},
{
"host": "上汽大众(0D)",
"code": "0M",
"name": "MODELL K/Tiguan/Tiguan FL/Tiguan Bluemotion/ Tiguan NF/Tiguan PHEV/Tiguan coupe"
},
{
"host": "上汽大众(0D)",
"code": "1M",
"name": "AUDI A+SUV"
},
{
"host": "上汽大众(0D)",
"code": "0N",
"name": "MODEL Y MP11"
},
{
"host": "上汽大众(0D)",
"code": "1N",
"name": "T-Cross PA"
},
{
"host": "上汽大众(0D)",
"code": "0P",
"name": "MODELL H"
},
{
"host": "上汽大众(0D)",
"code": "1P",
"name": "B SUV PA"
},
{
"host": "上汽大众(0D)",
"code": "0Q",
"name": "MODELL Z/NMS3.0 V6/NMS MP13"
},
{
"host": "上汽大众(0D)",
"code": "1Q",
"name": "Audi C SUV"
},
{
"host": "上汽大众(0D)",
"code": "0R",
"name": "lavida  Derivat/Lavida crosslin"
},
{
"host": "上汽大众(0D)",
"code": "1R",
"name": "Entry NB/Entry NB CS"
},
{
"host": "上汽大众(0D)",
"code": "0S",
"name": "YETI"
},
{
"host": "上汽大众(0D)",
"code": "1S",
"name": "ID6X"
},
{
"host": "上汽大众(0D)",
"code": "0T",
"name": "Octavia CN/Octavia NF/ Octavia NF MP17"
},
{
"host": "上汽大众(0D)",
"code": "1T",
"name": "Passat B9"
},
{
"host": "上汽大众(0D)",
"code": "1U",
"name": "ID3X"
},
{
"host": "上汽大众(0D)",
"code": "0W",
"name": "New Lavida MP14/MP15/Lavida NF/New Lavida silkroad"
},
{
"host": "上汽大众(0D)",
"code": "1W",
"name": "Teramont NF"
},
{
"host": "上汽大众(0D)",
"code": "0X",
"name": "POLO GP"
},
{
"host": "上汽大众(0D)",
"code": "1X",
"name": "AERO B"
},
{
"host": "上汽大众(0D)",
"code": "0Y",
"name": "Fabia NF"
},
{
"host": "上汽大众(0D)",
"code": "1Y",
"name": "DEMO"
},
{
"host": "上汽大众(0D)",
"code": "0Z",
"name": "NMS GP"
},
{
"host": "长安汽车\n(0E)",
"code": "0A",
"name": "CD34X"
},
{
"host": "长安汽车\n(0E)",
"code": "1A",
"name": "C211/C211-ICA/C211MCA-r/C211-EV5"
},
{
"host": "长安汽车\n(0E)",
"code": "2A",
"name": "C301MCA"
},
{
"host": "长安汽车\n(0E)",
"code": "0B",
"name": "J68CC"
},
{
"host": "长安汽车\n(0E)",
"code": "1B",
"name": "R104/F201-EV"
},
{
"host": "长安汽车\n(0E)",
"code": "2B",
"name": "P201MCA"
},
{
"host": "长安汽车\n(0E)",
"code": "0C",
"name": "C303(纯电动车)/ C201"
},
{
"host": "长安汽车\n(0E)",
"code": "1C",
"name": "S111"
},
{
"host": "长安汽车\n(0E)",
"code": "2C",
"name": "CD701"
},
{
"host": "长安汽车\n(0E)",
"code": "0D",
"name": "C302/长安 S301"
},
{
"host": "长安汽车\n(0E)",
"code": "1D",
"name": "I-Driver"
},
{
"host": "长安汽车\n(0E)",
"code": "2D",
"name": "P201RE"
},
{
"host": "长安汽车\n(0E)",
"code": "0E",
"name": "CD101"
},
{
"host": "长安汽车\n(0E)",
"code": "1E",
"name": "S301-18"
},
{
"host": "长安汽车\n(0E)",
"code": "0F",
"name": "B211"
},
{
"host": "长安汽车\n(0E)",
"code": "1F",
"name": "S302/S302-ICA"
},
{
"host": "长安汽车\n(0E)",
"code": "0G",
"name": "S101"
},
{
"host": "长安汽车\n(0E)",
"code": "1G",
"name": "P201/P201-RHD/KP1-RHD"
},
{
"host": "长安汽车\n(0E)",
"code": "0H",
"name": "S401/S401 ICA/S401 MCA/S401B/S401-MCA-G6/S401-MCA2"
},
{
"host": "长安汽车\n(0E)",
"code": "1H",
"name": "V402"
},
{
"host": "长安汽车\n(0E)",
"code": "0K",
"name": "B207"
},
{
"host": "长安汽车\n(0E)",
"code": "1K",
"name": "S311"
},
{
"host": "长安汽车\n(0E)",
"code": "0L",
"name": "B501"
},
{
"host": "长安汽车\n(0E)",
"code": "1L",
"name": "A001"
},
{
"host": "长安汽车\n(0E)",
"code": "0M",
"name": "R103/R103-H15T/R103-18/R103-PAC"
},
{
"host": "长安汽车\n(0E)",
"code": "1M",
"name": "F202/F202-RHD/F202-MCA"
},
{
"host": "长安汽车\n(0E)",
"code": "0N",
"name": "B311/B311-EV-MCA"
},
{
"host": "长安汽车\n(0E)",
"code": "1N",
"name": "F202EV"
},
{
"host": "长安汽车\n(0E)",
"code": "0P",
"name": "V301"
},
{
"host": "长安汽车\n(0E)",
"code": "1P",
"name": "E1平台/F2平台/F2+平台"
},
{
"host": "长安汽车\n(0E)",
"code": "0Q",
"name": "C201-16款/逸动"
},
{
"host": "长安汽车\n(0E)",
"code": "1Q",
"name": "S203-EV"
},
{
"host": "长安汽车\n(0E)",
"code": "0R",
"name": "CD101-16款/睿骋"
},
{
"host": "长安汽车\n(0E)",
"code": "1R",
"name": "S201-MCA"
},
{
"host": "长安汽车\n(0E)",
"code": "0S",
"name": "S101-16款/17款"
},
{
"host": "长安汽车\n(0E)",
"code": "1S",
"name": "C281"
},
{
"host": "长安汽车\n(0E)",
"code": "0T",
"name": "S301-17款"
},
{
"host": "长安汽车\n(0E)",
"code": "1T",
"name": "S101-S"
},
{
"host": "长安汽车\n(0E)",
"code": "0U",
"name": "C207"
},
{
"host": "长安汽车\n(0E)",
"code": "1U",
"name": "CD569"
},
{
"host": "长安汽车\n(0E)",
"code": "0W",
"name": "C301"
},
{
"host": "长安汽车\n(0E)",
"code": "1W",
"name": "R111"
},
{
"host": "长安汽车\n(0E)",
"code": "0X",
"name": "V302/V302-D2OT/V302 H15G"
},
{
"host": "长安汽车\n(0E)",
"code": "1X",
"name": "F202-ICA"
},
{
"host": "长安汽车\n(0E)",
"code": "0Y",
"name": "B511/B511-RHD"
},
{
"host": "长安汽车\n(0E)",
"code": "1Y",
"name": "C301ICA-rr"
},
{
"host": "长安汽车\n(0E)",
"code": "0Z",
"name": "V301-S"
},
{
"host": "长安汽车\n(0E)",
"code": "1Z",
"name": "S302-ICA2"
},
{
"host": "广汽集团(0F)",
"code": "0A",
"name": "长丰"
},
{
"host": "广汽集团(0F)",
"code": "1A",
"name": "A26(新能源)"
},
{
"host": "广汽集团(0F)",
"code": "2A",
"name": "A09"
},
{
"host": "广汽集团(0F)",
"code": "0B",
"name": "E2"
},
{
"host": "广汽集团(0F)",
"code": "1B",
"name": "A39/A57/A58"
},
{
"host": "广汽集团(0F)",
"code": "2B",
"name": "A9E"
},
{
"host": "广汽集团(0F)",
"code": "0C",
"name": "CF2/CS6"
},
{
"host": "广汽集团(0F)",
"code": "1C",
"name": "A12/A12年款"
},
{
"host": "广汽集团(0F)",
"code": "2C",
"name": "A8E"
},
{
"host": "广汽集团(0F)",
"code": "0D",
"name": "CS7"
},
{
"host": "广汽集团(0F)",
"code": "1D",
"name": "A86"
},
{
"host": "广汽集团(0F)",
"code": "2D",
"name": "T60-Y"
},
{
"host": "广汽集团(0F)",
"code": "0E",
"name": "CT5"
},
{
"host": "广汽集团(0F)",
"code": "1E",
"name": "A92"
},
{
"host": "广汽集团(0F)",
"code": "2E",
"name": "A58-G"
},
{
"host": "广汽集团(0F)",
"code": "0F",
"name": "广汽3E45帕杰罗劲畅"
},
{
"host": "广汽集团(0F)",
"code": "1F",
"name": "A18(新能源）/A18-Y"
},
{
"host": "广汽集团(0F)",
"code": "2F",
"name": "T6E"
},
{
"host": "广汽集团(0F)",
"code": "0G",
"name": "猎豹先锋"
},
{
"host": "广汽集团(0F)",
"code": "1G",
"name": "广汽蔚来 GN01"
},
{
"host": "广汽集团(0F)",
"code": "2G",
"name": "T6F"
},
{
"host": "广汽集团(0F)",
"code": "0H",
"name": "CT6"
},
{
"host": "广汽集团(0F)",
"code": "1H",
"name": "AM8/AM8年款/AM8-Y"
},
{
"host": "广汽集团(0F)",
"code": "2H",
"name": "A5X"
},
{
"host": "广汽集团(0F)",
"code": "0K",
"name": "传祺A30(A30-Ⅰ)"
},
{
"host": "广汽集团(0F)",
"code": "1K",
"name": "XR5"
},
{
"host": "广汽集团(0F)",
"code": "2K",
"name": "A79-G"
},
{
"host": "广汽集团(0F)",
"code": "0L",
"name": "广汽A51(CA3电动车)"
},
{
"host": "广汽集团(0F)",
"code": "1L",
"name": "A76"
},
{
"host": "广汽集团(0F)",
"code": "2L",
"name": "GM8"
},
{
"host": "广汽集团(0F)",
"code": "0M",
"name": "广汽A7M/A9M"
},
{
"host": "广汽集团(0F)",
"code": "1M",
"name": "A55"
},
{
"host": "广汽集团(0F)",
"code": "0N",
"name": "广汽A5H/A5H-6"
},
{
"host": "广汽集团(0F)",
"code": "1N",
"name": "A36"
},
{
"host": "广汽集团(0F)",
"code": "0P",
"name": "广汽A2A"
},
{
"host": "广汽集团(0F)",
"code": "1P",
"name": "A20/GN05"
},
{
"host": "广汽集团(0F)",
"code": "0Q",
"name": "广汽A16/A16-Y"
},
{
"host": "广汽集团(0F)",
"code": "1Q",
"name": "A27"
},
{
"host": "广汽集团(0F)",
"code": "0R",
"name": "广汽A32"
},
{
"host": "广汽集团(0F)",
"code": "1R",
"name": "A60/A6V"
},
{
"host": "广汽集团(0F)",
"code": "0S",
"name": "A06"
},
{
"host": "广汽集团(0F)",
"code": "1S",
"name": "A08"
},
{
"host": "广汽集团(0F)",
"code": "0T",
"name": "A10/A10-A/A10中东"
},
{
"host": "广汽集团(0F)",
"code": "1T",
"name": "A11/A11-Y"
},
{
"host": "广汽集团(0F)",
"code": "0U",
"name": "广汽 A2A EV"
},
{
"host": "广汽集团(0F)",
"code": "1U",
"name": "A2R"
},
{
"host": "广汽集团(0F)",
"code": "0W",
"name": "广汽 A35/A35中东/A45"
},
{
"host": "广汽集团(0F)",
"code": "1W",
"name": "A29/20-Y"
},
{
"host": "广汽集团(0F)",
"code": "0X",
"name": "传祺A30(A30-Ⅱ)"
},
{
"host": "广汽集团(0F)",
"code": "1X",
"name": "A88"
},
{
"host": "广汽集团(0F)",
"code": "0Y",
"name": "广汽A3K"
},
{
"host": "广汽集团(0F)",
"code": "1Y",
"name": "A13"
},
{
"host": "广汽集团(0F)",
"code": "0Z",
"name": "A90"
},
{
"host": "广汽集团(0F)",
"code": "1Z",
"name": "A79"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0A",
"name": "常州星宇(非大众产品)"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0B",
"name": "MQB A0"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0C",
"name": "T6PA"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0D",
"name": "AU326"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0E",
"name": "AU651/0EU_KCL"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0F",
"name": "AU641"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0G",
"name": "MN54T/SE316/VN46T/VW371"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0H",
"name": "Q7"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0K",
"name": "Q8"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0L",
"name": "VW492"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0M",
"name": "卡宴 PO546"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0N",
"name": "AU416/AU416 Q6"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0P",
"name": "VW216"
},
{
"host": "德国大众 /德国奥迪/海外大众(0G)",
"code": "0Q",
"name": "Meteor"
},
{
"host": "哈飞汽车\n(0H)",
"code": "0A",
"name": "HF3A(HFJ7131/赛豹/电动车)/HFJ7001AEV(赛豹)"
},
{
"host": "哈飞汽车\n(0H)",
"code": "0B",
"name": "HF5A"
},
{
"host": "哈飞汽车\n(0H)",
"code": "0C",
"name": "HF8"
},
{
"host": "哈飞汽车\n(0H)",
"code": "0D",
"name": "HF9"
},
{
"host": "哈飞汽车\n(0H)",
"code": "0E",
"name": "HF10"
},
{
"host": "哈飞汽车\n(0H)",
"code": "0F",
"name": "Coda AUtomotive 电动车项目"
},
{
"host": "哈飞汽车\n(0H)",
"code": "0G",
"name": "良子动力UTV1000"
},
{
"host": "哈飞汽车\n(0H)",
"code": "0H",
"name": "HM2"
},
{
"host": "北汽集团(0K)",
"code": "0A",
"name": "北京奔驰-戴姆勒.克莱斯勒J1"
},
{
"host": "北汽集团(0K)",
"code": "1A",
"name": "北汽福田S300/S300L(宝沃)/S300 21MY"
},
{
"host": "北汽集团(0K)",
"code": "2A",
"name": "B60V/VS"
},
{
"host": "北汽集团(0K)",
"code": "0B",
"name": "009"
},
{
"host": "北汽集团(0K)",
"code": "1B",
"name": "C53F"
},
{
"host": "北汽集团(0K)",
"code": "2B",
"name": "C46DB"
},
{
"host": "北汽集团(0K)",
"code": "0C",
"name": "BC301Z"
},
{
"host": "北汽集团(0K)",
"code": "1C",
"name": "B20B"
},
{
"host": "北汽集团(0K)",
"code": "2C",
"name": "B41V"
},
{
"host": "北汽集团(0K)",
"code": "0D",
"name": "C60F/C60F-M01/C70G"
},
{
"host": "北汽集团(0K)",
"code": "1D",
"name": "S25"
},
{
"host": "北汽集团(0K)",
"code": "2D",
"name": "N50AB"
},
{
"host": "北汽集团(0K)",
"code": "0E",
"name": "BC302Z"
},
{
"host": "北汽集团(0K)",
"code": "1E",
"name": "S7N1(宝沃)"
},
{
"host": "北汽集团(0K)",
"code": "2E",
"name": "B40-F13"
},
{
"host": "北汽集团(0K)",
"code": "0F",
"name": "C50E"
},
{
"host": "北汽集团(0K)",
"code": "1F",
"name": "C40D/C40DB/C40D-C06/C40DB-F01"
},
{
"host": "北汽集团(0K)",
"code": "2F",
"name": "C32B E22"
},
{
"host": "北汽集团(0K)",
"code": "0G",
"name": "B40V/B40 M01"
},
{
"host": "北汽集团(0K)",
"code": "1G",
"name": "C21(北汽银翔)"
},
{
"host": "北汽集团(0K)",
"code": "2G",
"name": "C62X-E09/E10"
},
{
"host": "北汽集团(0K)",
"code": "0H",
"name": "北汽福田S700(宝沃)/S700-2020"
},
{
"host": "北汽集团(0K)",
"code": "1H",
"name": "M01(取消)"
},
{
"host": "北汽集团(0K)",
"code": "2H",
"name": "B50X"
},
{
"host": "北汽集团(0K)",
"code": "1J",
"name": "B40L-F05/B40L-M02/B40L-M33/B40L-Z37/B40L-M19/"
},
{
"host": "北汽集团(0K)",
"code": "0K",
"name": "B80V勇士/B80J(军用版)/B80B(民用版)/B80C/B80D/B80CJ/ B80C-M01/B80CJ-M01/B80J-C03/B80CJ-E02/B80C-Z13/B80C-M09/B80J-C05/B80J-C07/B80J-E02/B80J几内亚/B80C-Z20"
},
{
"host": "北汽集团(0K)",
"code": "1K",
"name": "H32B-M05"
},
{
"host": "北汽集团(0K)",
"code": "2K",
"name": "N60AB-M08"
},
{
"host": "北汽集团(0K)",
"code": "0L",
"name": "B70V"
},
{
"host": "北汽集团(0K)",
"code": "1L",
"name": "C62X/C62X-MO1/C62XP/C62X-M05/C62X-F06"
},
{
"host": "北汽集团(0K)",
"code": "2L",
"name": "C52X-E03"
},
{
"host": "北汽集团(0K)",
"code": "0M",
"name": "C61X"
},
{
"host": "北汽集团(0K)",
"code": "1M",
"name": "B40-M03"
},
{
"host": "北汽集团(0K)",
"code": "2M",
"name": "北汽福田NP6"
},
{
"host": "北汽集团(0K)",
"code": "0N",
"name": "C30D"
},
{
"host": "北汽集团(0K)",
"code": "1N",
"name": "重庆比速C80"
},
{
"host": "北汽集团(0K)",
"code": "2N",
"name": "B60VS-M01"
},
{
"host": "北汽集团(0K)",
"code": "0P",
"name": "C30D/C31D进口版/M07"
},
{
"host": "北汽集团(0K)",
"code": "1P",
"name": "S5N1(宝沃)"
},
{
"host": "北汽集团(0K)",
"code": "2P",
"name": "B30X"
},
{
"host": "北汽集团(0K)",
"code": "0Q",
"name": "C20(北汽银翔)"
},
{
"host": "北汽集团(0K)",
"code": "1Q",
"name": "H32B-M04"
},
{
"host": "北汽集团(0K)",
"code": "2Q",
"name": "C40D-E24"
},
{
"host": "北汽集团(0K)",
"code": "0R",
"name": "B40L/B40L精品车/B40L-F13/B40L M32/B40L E38"
},
{
"host": "北汽集团(0K)",
"code": "1R",
"name": "C40D-M05"
},
{
"host": "北汽集团(0K)",
"code": "2R",
"name": "C62X-E12"
},
{
"host": "北汽集团(0K)",
"code": "0S",
"name": "C51E/C51E-F05/C51EB"
},
{
"host": "北汽集团(0K)",
"code": "1S",
"name": "N60AB"
},
{
"host": "北汽集团(0K)",
"code": "2S",
"name": "C52X-E07"
},
{
"host": "北汽集团(0K)",
"code": "0T",
"name": "C33D/C33DB-M07"
},
{
"host": "北汽集团(0K)",
"code": "1T",
"name": "C53FB"
},
{
"host": "北汽集团(0K)",
"code": "2T",
"name": "B41VS"
},
{
"host": "北汽集团(0K)",
"code": "1U",
"name": "北汽福田ET/EV-NP6"
},
{
"host": "北汽集团(0K)",
"code": "2U",
"name": "B60VS"
},
{
"host": "北汽集团(0K)",
"code": "0W",
"name": "H20(北汽银翔)"
},
{
"host": "北汽集团(0K)",
"code": "1W",
"name": "N61AB/N61AB-C01"
},
{
"host": "北汽集团(0K)",
"code": "0X",
"name": "B20A/B20A-F05"
},
{
"host": "北汽集团(0K)",
"code": "1X",
"name": "B80F"
},
{
"host": "北汽集团(0K)",
"code": "0Y",
"name": "北汽福田S500(宝沃)"
},
{
"host": "北汽集团(0K)",
"code": "1Y",
"name": "C40D-F09"
},
{
"host": "北汽集团(0K)",
"code": "0Z",
"name": "H50(北汽银翔)"
},
{
"host": "北汽集团(0K)",
"code": "1Z",
"name": "C52X/C52X E01"
},
{
"host": "吉利(0L)",
"code": "0A",
"name": "CK-1"
},
{
"host": "吉利(0L)",
"code": "1A",
"name": "BX11 P/H"
},
{
"host": "吉利(0L)",
"code": "2A",
"name": "E171"
},
{
"host": "吉利(0L)",
"code": "0B",
"name": "FC-1/右舵/华普海锋海域"
},
{
"host": "吉利(0L)",
"code": "1B",
"name": "GE13"
},
{
"host": "吉利(0L)",
"code": "2B",
"name": "V51DK"
},
{
"host": "吉利(0L)",
"code": "0C",
"name": "FC-2"
},
{
"host": "吉利(0L)",
"code": "1C",
"name": "CS11/CS11 AC/CS11 B1"
},
{
"host": "吉利(0L)",
"code": "2C",
"name": "EX11-ME"
},
{
"host": "吉利(0L)",
"code": "0D",
"name": "TX4/TX4出口版"
},
{
"host": "吉利(0L)",
"code": "1D",
"name": "CS11 6AT"
},
{
"host": "吉利(0L)",
"code": "2D",
"name": "EX11-A3"
},
{
"host": "吉利(0L)",
"code": "0E",
"name": "CC-1/GC-1(D/减配)/GC-1Ⅰ"
},
{
"host": "吉利(0L)",
"code": "1E",
"name": "CS11 A3/CX11 A3"
},
{
"host": "吉利(0L)",
"code": "2E",
"name": "EF1E-A1"
},
{
"host": "吉利(0L)",
"code": "0F",
"name": "NL-1(标准型)/NL-2/NL-1Y"
},
{
"host": "吉利(0L)",
"code": "0G",
"name": "FE-1"
},
{
"host": "吉利(0L)",
"code": "1G",
"name": "FS11"
},
{
"host": "吉利(0L)",
"code": "0H",
"name": "HL-1"
},
{
"host": "吉利(0L)",
"code": "1H",
"name": "DC1E"
},
{
"host": "吉利(0L)",
"code": "0K",
"name": "华普SL-1"
},
{
"host": "吉利(0L)",
"code": "1K",
"name": "HX11"
},
{
"host": "吉利(0L)",
"code": "0L",
"name": "GC-1L"
},
{
"host": "吉利(0L)",
"code": "1L",
"name": "HC11"
},
{
"host": "吉利(0L)",
"code": "0M",
"name": "NL-2(EX8)"
},
{
"host": "吉利(0L)",
"code": "1M",
"name": "Lambda"
},
{
"host": "吉利(0L)",
"code": "0N",
"name": "NL-2D/NL-2A"
},
{
"host": "吉利(0L)",
"code": "1N",
"name": "Gamma"
},
{
"host": "吉利(0L)",
"code": "0P",
"name": "KC-1"
},
{
"host": "吉利(0L)",
"code": "1P",
"name": "CX11"
},
{
"host": "吉利(0L)",
"code": "0Q",
"name": "EC8(GC-14款)"
},
{
"host": "吉利(0L)",
"code": "1Q",
"name": "BX1E"
},
{
"host": "吉利(0L)",
"code": "0R",
"name": "NL-4(重庆延峰江森)"
},
{
"host": "吉利(0L)",
"code": "1R",
"name": "V216"
},
{
"host": "吉利(0L)",
"code": "0S",
"name": "KC-2"
},
{
"host": "吉利(0L)",
"code": "1S",
"name": "CS1E"
},
{
"host": "吉利(0L)",
"code": "0T",
"name": "吉利GE11"
},
{
"host": "吉利(0L)",
"code": "1T",
"name": "DC1E A2"
},
{
"host": "吉利(0L)",
"code": "1U",
"name": "DC1E EU"
},
{
"host": "吉利(0L)",
"code": "0W",
"name": "CC11/CC11 A20/CC11 B1/CC11 B1 8AT"
},
{
"host": "吉利(0L)",
"code": "1W",
"name": "FS12"
},
{
"host": "吉利(0L)",
"code": "0X",
"name": "DCY11"
},
{
"host": "吉利(0L)",
"code": "1X",
"name": "BX11 A2"
},
{
"host": "吉利(0L)",
"code": "0Y",
"name": "EX11"
},
{
"host": "吉利(0L)",
"code": "1Y",
"name": "CM2E"
},
{
"host": "吉利(0L)",
"code": "0Z",
"name": "BX11/BX11-A1"
},
{
"host": "吉利(0L)",
"code": "1Z",
"name": "EF1E"
},
{
"host": "上汽集团(0M)",
"code": "0A",
"name": "RD16C(W161)/荣威750i/R75"
},
{
"host": "上汽集团(0M)",
"code": "1A",
"name": "SV71右舵"
},
{
"host": "上汽集团(0M)",
"code": "2A",
"name": "EX21"
},
{
"host": "上汽集团(0M)",
"code": "3A",
"name": "IM31 M3"
},
{
"host": "上汽集团(0M)",
"code": "0B",
"name": "RD16C(W161)/W162(1.8T)"
},
{
"host": "上汽集团(0M)",
"code": "1B",
"name": "IP2X MCE TT"
},
{
"host": "上汽集团(0M)",
"code": "2B",
"name": "ZS11 MCE3/ZS11 MCE3 UK/ZS11E MCE/ZS11 MCE TT HEV"
},
{
"host": "上汽集团(0M)",
"code": "3B",
"name": "AS32-X2"
},
{
"host": "上汽集团(0M)",
"code": "0C",
"name": "NMC1(W261)/IP21 MY09"
},
{
"host": "上汽集团(0M)",
"code": "1C",
"name": "AS21 TT"
},
{
"host": "上汽集团(0M)",
"code": "2C",
"name": "AS28/AS28M2/AS28MCE/AS28 M3/AS28 M2 & MCE/AS28P M3"
},
{
"host": "上汽集团(0M)",
"code": "3C",
"name": "AP32 MCE"
},
{
"host": "上汽集团(0M)",
"code": "0D",
"name": "AP11"
},
{
"host": "上汽集团(0M)",
"code": "1D",
"name": "IP31/IP31 MCE/IP32MCE/IP34MCE/IP31E平台化"
},
{
"host": "上汽集团(0M)",
"code": "2D",
"name": "IS31/IP42"
},
{
"host": "上汽集团(0M)",
"code": "3D",
"name": "ZP22"
},
{
"host": "上汽集团(0M)",
"code": "0E",
"name": "BP12"
},
{
"host": "上汽集团(0M)",
"code": "1E",
"name": "EV69(大通V80)"
},
{
"host": "上汽集团(0M)",
"code": "2E",
"name": "ZS11E TT/INDIA"
},
{
"host": "上汽集团(0M)",
"code": "3E",
"name": "EH32 MY24"
},
{
"host": "上汽集团(0M)",
"code": "0F",
"name": "ZP11(CROSS/MY12/EU)/ZP11-P3(左舵/右舵) /ZP11-MCE3"
},
{
"host": "上汽集团(0M)",
"code": "1F",
"name": "AS22/AS22 MCE/AS22 MCE 新百万"
},
{
"host": "上汽集团(0M)",
"code": "2F",
"name": "IS21 GCC/SA出口车型"
},
{
"host": "上汽集团(0M)",
"code": "3F",
"name": "IM31 MY22"
},
{
"host": "上汽集团(0M)",
"code": "0G",
"name": "IP22(EU)/IP23"
},
{
"host": "上汽集团(0M)",
"code": "1G",
"name": "IS12 MAJOR"
},
{
"host": "上汽集团(0M)",
"code": "2G",
"name": "IM31"
},
{
"host": "上汽集团(0M)",
"code": "3G",
"name": "EP39"
},
{
"host": "上汽集团(0M)",
"code": "0H",
"name": "IP21/22 CN"
},
{
"host": "上汽集团(0M)",
"code": "1H",
"name": "AP14"
},
{
"host": "上汽集团(0M)",
"code": "2H",
"name": "ER31"
},
{
"host": "上汽集团(0M)",
"code": "3H",
"name": "EH32PRO"
},
{
"host": "上汽集团(0M)",
"code": "0K",
"name": "IP21 MCE/IP24"
},
{
"host": "上汽集团(0M)",
"code": "1K",
"name": "IP32/IP32 MCE/IP32 MCE PRO/IP32 PRO"
},
{
"host": "上汽集团(0M)",
"code": "2K",
"name": "AP32/AP32 PRO/AP32-X2"
},
{
"host": "上汽集团(0M)",
"code": "3K",
"name": "IM31-P2"
},
{
"host": "上汽集团(0M)",
"code": "0L",
"name": "LDV/SV61(商用车/右舵)"
},
{
"host": "上汽集团(0M)",
"code": "1L",
"name": "ZS11/ZS11 TT\n/ZS11 E"
},
{
"host": "上汽集团(0M)",
"code": "2L",
"name": "AS32/ZS11 HEV TT"
},
{
"host": "上汽集团(0M)",
"code": "3L",
"name": "E2平台"
},
{
"host": "上汽集团(0M)",
"code": "0M",
"name": "AP12/NEW MG5"
},
{
"host": "上汽集团(0M)",
"code": "1M",
"name": "AS21 MCE"
},
{
"host": "上汽集团(0M)",
"code": "2M",
"name": "AX10"
},
{
"host": "上汽集团(0M)",
"code": "3M",
"name": "RIS3E & MIS3E-X1 &X2"
},
{
"host": "上汽集团(0M)",
"code": "0N",
"name": "EP11"
},
{
"host": "上汽集团(0M)",
"code": "1N",
"name": "EV79"
},
{
"host": "上汽集团(0M)",
"code": "2N",
"name": "AS33/EP33/EP33-M0/AS33&AS33P/AS33海外版"
},
{
"host": "上汽集团(0M)",
"code": "3N",
"name": "EH32-X9"
},
{
"host": "上汽集团(0M)",
"code": "0P",
"name": "BP31"
},
{
"host": "上汽集团(0M)",
"code": "1P",
"name": "IP34"
},
{
"host": "上汽集团(0M)",
"code": "2P",
"name": "AS24 MCE"
},
{
"host": "上汽集团(0M)",
"code": "3P",
"name": "ES37"
},
{
"host": "上汽集团(0M)",
"code": "0Q",
"name": "BP32/ BP32 MCE"
},
{
"host": "上汽集团(0M)",
"code": "1Q",
"name": "SV91/SV91-D3"
},
{
"host": "上汽集团(0M)",
"code": "2Q",
"name": "EH32"
},
{
"host": "上汽集团(0M)",
"code": "0R",
"name": "SV71/SV71 D20/SV71-D1"
},
{
"host": "上汽集团(0M)",
"code": "1R",
"name": "ZS12/ZS12 MCE3/ZS12 MCE HEV/ZS12 HEV"
},
{
"host": "上汽集团(0M)",
"code": "2R",
"name": "ES33"
},
{
"host": "上汽集团(0M)",
"code": "3R",
"name": "ZS32/AP31 MCE海外"
},
{
"host": "上汽集团(0M)",
"code": "0S",
"name": "AS21"
},
{
"host": "上汽集团(0M)",
"code": "1S",
"name": "EP21"
},
{
"host": "上汽集团(0M)",
"code": "2S",
"name": "EP35"
},
{
"host": "上汽集团(0M)",
"code": "3S",
"name": "ES33 M2"
},
{
"host": "上汽集团(0M)",
"code": "0T",
"name": "IP22/23 MY13"
},
{
"host": "上汽集团(0M)",
"code": "1T",
"name": "EP22/EP22 MCE/EP22 X1/EP37"
},
{
"host": "上汽集团(0M)",
"code": "2T",
"name": "IS31&IM31E&AS33"
},
{
"host": "上汽集团(0M)",
"code": "3T",
"name": "IP42-X1海外"
},
{
"host": "上汽集团(0M)",
"code": "2U",
"name": "ES32"
},
{
"host": "上汽集团(0M)",
"code": "3U",
"name": "AS32-M0"
},
{
"host": "上汽集团(0M)",
"code": "0W",
"name": "BP34 /BP3X/BP34改型"
},
{
"host": "上汽集团(0M)",
"code": "1W",
"name": "IS21"
},
{
"host": "上汽集团(0M)",
"code": "2W",
"name": "EP33L"
},
{
"host": "上汽集团(0M)",
"code": "3W",
"name": "AS32-X1"
},
{
"host": "上汽集团(0M)",
"code": "0X",
"name": "AP13"
},
{
"host": "上汽集团(0M)",
"code": "1X",
"name": "ZS11 EU"
},
{
"host": "上汽集团(0M)",
"code": "2X",
"name": "EC32"
},
{
"host": "上汽集团(0M)",
"code": "3X",
"name": "MZS3E"
},
{
"host": "上汽集团(0M)",
"code": "0Y",
"name": "AP11 MCE/AP11 MY17"
},
{
"host": "上汽集团(0M)",
"code": "1Y",
"name": "AS23/AS23RHD(右舵)/AS23 MCE/AS23 MCE高功率版"
},
{
"host": "上汽集团(0M)",
"code": "2Y",
"name": "EH32-M0"
},
{
"host": "上汽集团(0M)",
"code": "3Y",
"name": "SK81/SK82"
},
{
"host": "上汽集团(0M)",
"code": "0Z",
"name": "IS12"
},
{
"host": "上汽集团(0M)",
"code": "1Z",
"name": "AS23P"
},
{
"host": "上汽集团(0M)",
"code": "2Z",
"name": "AP31 MAJOR"
},
{
"host": "上汽集团(0M)",
"code": "3Z",
"name": "AS32 MY25出口"
},
{
"host": "北京现代(0N)",
"code": "0A",
"name": "NU/NU-FL/NU-PE/NU俄罗斯"
},
{
"host": "北京现代(0N)",
"code": "1A",
"name": "DN8C NLINE"
},
{
"host": "北京现代(0N)",
"code": "0B",
"name": "QXC"
},
{
"host": "北京现代(0N)",
"code": "1B",
"name": "TBD"
},
{
"host": "北京现代(0N)",
"code": "0C",
"name": "SQ"
},
{
"host": "北京现代(0N)",
"code": "0D",
"name": "OSC"
},
{
"host": "北京现代(0N)",
"code": "0E",
"name": "TMC/TMC 20MY/TMC FL/TMC 23MY"
},
{
"host": "北京现代(0N)",
"code": "0F",
"name": "SU2"
},
{
"host": "北京现代(0N)",
"code": "0G",
"name": "翰昂 CK"
},
{
"host": "北京现代(0N)",
"code": "0H",
"name": "DU2"
},
{
"host": "北京现代(0N)",
"code": "0K",
"name": "KU"
},
{
"host": "北京现代(0N)",
"code": "1K",
"name": "DN8C"
},
{
"host": "北京现代(0N)",
"code": "0L",
"name": "CN7c"
},
{
"host": "北京现代(0N)",
"code": "0M",
"name": "NX4C/NX4c HEV & N-Line"
},
{
"host": "北京现代(0N)",
"code": "0N",
"name": "NEC"
},
{
"host": "北京现代(0N)",
"code": "0P",
"name": "SQ FL"
},
{
"host": "北京现代(0N)",
"code": "0Q",
"name": "OE"
},
{
"host": "北京现代(0N)",
"code": "0S",
"name": "TMC 22MY"
},
{
"host": "北京现代(0N)",
"code": "0T",
"name": "DN8C SE"
},
{
"host": "北京现代(0N)",
"code": "0U",
"name": "SUV"
},
{
"host": "北京现代(0N)",
"code": "0W",
"name": "CN7C PE"
},
{
"host": "北京现代(0N)",
"code": "0X",
"name": "DN8C FL"
},
{
"host": "北京现代(0N)",
"code": "0Y",
"name": "NX4C FL"
},
{
"host": "北京现代(0N)",
"code": "0Z",
"name": "NX4C PE"
},
{
"host": "长  城(0P)",
"code": "0A",
"name": "迪尔/华北"
},
{
"host": "长  城(0P)",
"code": "1A",
"name": "CH035"
},
{
"host": "长  城(0P)",
"code": "2A",
"name": "A&B30平台"
},
{
"host": "长  城(0P)",
"code": "3A",
"name": "P3013"
},
{
"host": "长  城(0P)",
"code": "4A",
"name": "P03 PHEV"
},
{
"host": "长  城(0P)",
"code": "5A",
"name": "CS51-A"
},
{
"host": "长  城(0P)",
"code": "0B",
"name": "M11/M18((右舵)/SGM813"
},
{
"host": "长  城(0P)",
"code": "1B",
"name": "CHB041"
},
{
"host": "长  城(0P)",
"code": "2B",
"name": "K7/K7-22"
},
{
"host": "长  城(0P)",
"code": "3B",
"name": "P01/P01赛博版/P01N-YY/P01G/P01N"
},
{
"host": "长  城(0P)",
"code": "4B",
"name": "B16"
},
{
"host": "长  城(0P)",
"code": "5B",
"name": "P71-1PF"
},
{
"host": "长  城(0P)",
"code": "0C",
"name": "S08/V08/Y08/绚丽/S56/M4"
},
{
"host": "长  城(0P)",
"code": "1C",
"name": "长城哈弗H5/H5-18"
},
{
"host": "长  城(0P)",
"code": "2C",
"name": "P3011/P3011(俄罗斯）/P3011D-1/P3011F/P3011平台/P3011-22/P3011-2/P3012-2/P3013-2"
},
{
"host": "长  城(0P)",
"code": "3C",
"name": "P02"
},
{
"host": "长  城(0P)",
"code": "4C",
"name": "CS51"
},
{
"host": "长  城(0P)",
"code": "5C",
"name": "P05G-YY"
},
{
"host": "长  城(0P)",
"code": "0D",
"name": "G08/CH041/CH031/G47/CH042"
},
{
"host": "长  城(0P)",
"code": "1D",
"name": "CH072(哈弗H2改款)"
},
{
"host": "长  城(0P)",
"code": "2D",
"name": "EC01"
},
{
"host": "长  城(0P)",
"code": "3D",
"name": "P03"
},
{
"host": "长  城(0P)",
"code": "4D",
"name": "CP61"
},
{
"host": "长  城(0P)",
"code": "5D",
"name": "P05G"
},
{
"host": "长  城(0P)",
"code": "0E",
"name": "CH041"
},
{
"host": "长  城(0P)",
"code": "1E",
"name": "CHB025/CHB025A(哈弗H6改款)/CHB025A（M6P）"
},
{
"host": "长  城(0P)",
"code": "2E",
"name": "B30/B04"
},
{
"host": "长  城(0P)",
"code": "3E",
"name": "B06PHEV/HEV"
},
{
"host": "长  城(0P)",
"code": "4E",
"name": "P11/P11G"
},
{
"host": "长  城(0P)",
"code": "5E",
"name": "DE09"
},
{
"host": "长  城(0P)",
"code": "0F",
"name": "CHB021(/哈弗H6)"
},
{
"host": "长  城(0P)",
"code": "1F",
"name": "CHB012-16款(长城C50E-16款)"
},
{
"host": "长  城(0P)",
"code": "2F",
"name": "P3012/P3012EG/P3012G-THA/P3012G/P3012-21"
},
{
"host": "长  城(0P)",
"code": "3F",
"name": "K2海外"
},
{
"host": "长  城(0P)",
"code": "4F",
"name": "EC31"
},
{
"host": "长  城(0P)",
"code": "5F",
"name": "A08G"
},
{
"host": "长  城(0P)",
"code": "0G",
"name": "CHB011/CHB011-14款"
},
{
"host": "长  城(0P)",
"code": "1G",
"name": "CHB061"
},
{
"host": "长  城(0P)",
"code": "2G",
"name": "EC02"
},
{
"host": "长  城(0P)",
"code": "3G",
"name": "B02&B02PHEV"
},
{
"host": "长  城(0P)",
"code": "4G",
"name": "ES11-3"
},
{
"host": "长  城(0P)",
"code": "5G",
"name": "D02-1"
},
{
"host": "长  城(0P)",
"code": "0H",
"name": "CH042(J29)/哈弗 13款/ CH041 14款/CH041 15款"
},
{
"host": "长  城(0P)",
"code": "1H",
"name": "CHB045"
},
{
"host": "长  城(0P)",
"code": "2H",
"name": "P3011 EV"
},
{
"host": "长  城(0P)",
"code": "3H",
"name": "P05"
},
{
"host": "长  城(0P)",
"code": "4H",
"name": "A08-1"
},
{
"host": "长  城(0P)",
"code": "0K",
"name": "长城哈弗"
},
{
"host": "长  城(0P)",
"code": "1K",
"name": "CHB022-16款"
},
{
"host": "长  城(0P)",
"code": "2K",
"name": "CHB平台"
},
{
"host": "长  城(0P)",
"code": "3K",
"name": "P06/P06G"
},
{
"host": "长  城(0P)",
"code": "4K",
"name": "B01-3"
},
{
"host": "长  城(0P)",
"code": "0L",
"name": "CHK011/H8-17"
},
{
"host": "长  城(0P)",
"code": "1L",
"name": "C30(电动车)"
},
{
"host": "长  城(0P)",
"code": "2L",
"name": "D01/D02"
},
{
"host": "长  城(0P)",
"code": "3L",
"name": "AC01"
},
{
"host": "长  城(0P)",
"code": "4L",
"name": "P09"
},
{
"host": "长  城(0P)",
"code": "0M",
"name": "CHB031/CHB031 右舵/CHB031海外版/CHB031A/CHB031-17款"
},
{
"host": "长  城(0P)",
"code": "1M",
"name": "M4-17款"
},
{
"host": "长  城(0P)",
"code": "2M",
"name": "CHB131B/CHB131B-2"
},
{
"host": "长  城(0P)",
"code": "3M",
"name": "M83/M81"
},
{
"host": "长  城(0P)",
"code": "4M",
"name": "V61PHEV-2"
},
{
"host": "长  城(0P)",
"code": "0N",
"name": "CHB022/CHB022A"
},
{
"host": "长  城(0P)",
"code": "1N",
"name": "CHB071/CHB071-19"
},
{
"host": "长  城(0P)",
"code": "2N",
"name": "CHB125"
},
{
"host": "长  城(0P)",
"code": "3N",
"name": "B07"
},
{
"host": "长  城(0P)",
"code": "4N",
"name": "V51EV"
},
{
"host": "长  城(0P)",
"code": "0P",
"name": "CH071(哈弗H2)"
},
{
"host": "长  城(0P)",
"code": "1P",
"name": "CHB035"
},
{
"host": "长  城(0P)",
"code": "2P",
"name": "B06/B01/B06-22"
},
{
"host": "长  城(0P)",
"code": "3P",
"name": "CC02"
},
{
"host": "长  城(0P)",
"code": "4P",
"name": "P01S"
},
{
"host": "长  城(0P)",
"code": "0Q",
"name": "CHK041(哈弗H9)"
},
{
"host": "长  城(0P)",
"code": "1Q",
"name": "CHB065"
},
{
"host": "长  城(0P)",
"code": "2Q",
"name": "风骏5"
},
{
"host": "长  城(0P)",
"code": "3Q",
"name": "A05&V72"
},
{
"host": "长  城(0P)",
"code": "4Q",
"name": "B26"
},
{
"host": "长  城(0P)",
"code": "0R",
"name": "CHB012"
},
{
"host": "长  城(0P)",
"code": "1R",
"name": "CH141E"
},
{
"host": "长  城(0P)",
"code": "2R",
"name": "CHB121V-19"
},
{
"host": "长  城(0P)",
"code": "3R",
"name": "P系列平台化 （长城坦克系列）"
},
{
"host": "长  城(0P)",
"code": "4R",
"name": "P3011D-2"
},
{
"host": "长  城(0P)",
"code": "0S",
"name": "风骏6/K6/风骏17款"
},
{
"host": "长  城(0P)",
"code": "1S",
"name": "CHB073/CHB073EAD/CHB071EAD/H7"
},
{
"host": "长  城(0P)",
"code": "2S",
"name": "ES11/ES11G"
},
{
"host": "长  城(0P)",
"code": "3S",
"name": "D03"
},
{
"host": "长  城(0P)",
"code": "4S",
"name": "P3011E"
},
{
"host": "长  城(0P)",
"code": "0T",
"name": "M2"
},
{
"host": "长  城(0P)",
"code": "1T",
"name": "CHB042/CHB042-19"
},
{
"host": "长  城(0P)",
"code": "2T",
"name": "A30平台化(A01/A02/A07)/A08/A07-PHEV/A07-EV"
},
{
"host": "长  城(0P)",
"code": "3T",
"name": "P03-1G"
},
{
"host": "长  城(0P)",
"code": "2U",
"name": "V71/V61/V51/V51-EVR/V71欧盟/V71DHT/V51EV-右舵/V71DHT-3"
},
{
"host": "长  城(0P)",
"code": "3U",
"name": "P04"
},
{
"host": "长  城(0P)",
"code": "1V",
"name": "CHB027/CHB027-21款/CHB027俄罗斯版"
},
{
"host": "长  城(0P)",
"code": "0W",
"name": "CH041 右舵"
},
{
"host": "长  城(0P)",
"code": "1W",
"name": "CH151X"
},
{
"host": "长  城(0P)",
"code": "2W",
"name": "A01G(A01右舵）"
},
{
"host": "长  城(0P)",
"code": "3W",
"name": "DE04"
},
{
"host": "长  城(0P)",
"code": "0X",
"name": "哈弗 14款"
},
{
"host": "长  城(0P)",
"code": "1X",
"name": "A/C平台"
},
{
"host": "长  城(0P)",
"code": "2X",
"name": "EC24/EC24B/ES13/ES24/EC24-1/EC24海外版/EC24-1海外版"
},
{
"host": "长  城(0P)",
"code": "3X",
"name": "C01"
},
{
"host": "长  城(0P)",
"code": "0Y",
"name": "CHK041 右舵"
},
{
"host": "长  城(0P)",
"code": "1Y",
"name": "CHB037/CHB037-21款"
},
{
"host": "长  城(0P)",
"code": "2Y",
"name": "A01-PHEV"
},
{
"host": "长  城(0P)",
"code": "3Y",
"name": "炮22款"
},
{
"host": "长  城(0P)",
"code": "0Z",
"name": "CHB011 改款"
},
{
"host": "长  城(0P)",
"code": "1Z",
"name": "CHB132/CHB131-19"
},
{
"host": "长  城(0P)",
"code": "2Z",
"name": "B03"
},
{
"host": "长  城(0P)",
"code": "3Z",
"name": "P3011G"
},
{
"host": "长城华冠(0Q)",
"code": "0A",
"name": "M系列/M2.0 AT"
},
{
"host": "长城华冠(0Q)",
"code": "0B",
"name": "P系列"
},
{
"host": "长城华冠(0Q)",
"code": "0C",
"name": "东风裕隆 SU M/C"
},
{
"host": "长城华冠(0Q)",
"code": "0D",
"name": "东风裕隆 MV M/C"
},
{
"host": "长城华冠(0Q)",
"code": "0E",
"name": "东风裕隆 LCS"
},
{
"host": "长城华冠(0Q)",
"code": "0F",
"name": "东风裕隆GPS MC/GPS-15款"
},
{
"host": "长城华冠(0Q)",
"code": "0G",
"name": "东风裕隆 GPK"
},
{
"host": "长城华冠(0Q)",
"code": "0H",
"name": "长城华冠 HG11B"
},
{
"host": "长城华冠(0Q)",
"code": "0K",
"name": "上海申沃客车 SWB6108BEV"
},
{
"host": "长城华冠(0Q)",
"code": "0L",
"name": "上海万向新能源 SV71"
},
{
"host": "长城华冠(0Q)",
"code": "0M",
"name": "长城华冠 HG10B"
},
{
"host": "二次配套(0R)",
"code": "0A",
"name": "波导M1A/RB项目"
},
{
"host": "二次配套(0R)",
"code": "0B",
"name": "长安CD101"
},
{
"host": "二次配套(0R)",
"code": "0C",
"name": "众泰T600(江苏裕华)"
},
{
"host": "二次配套(0R)",
"code": "0D",
"name": "重庆江森HG11B"
},
{
"host": "二次配套(0R)",
"code": "0E",
"name": "延锋智能INEOS（二次配套）"
},
{
"host": "二次配套(0R)",
"code": "0F",
"name": "诺博汽车V71欧盟"
},
{
"host": "二次配套(0R)",
"code": "0G",
"name": "诺博汽车ES11G/ES11"
},
{
"host": "二次配套(0R)",
"code": "0H",
"name": "诺博汽车V61欧盟"
},
{
"host": "二次配套(0R)",
"code": "0K",
"name": "诺博汽车P03"
},
{
"host": "二次配套(0R)",
"code": "0L",
"name": "诺博VIU平台"
},
{
"host": "二次配套(0R)",
"code": "0M",
"name": "诺博V72"
},
{
"host": "二次配套(0R)",
"code": "0N",
"name": "Grenadier"
},
{
"host": "二次配套(0R)",
"code": "0P",
"name": "INEOS GrenE"
},
{
"host": "西雅特\n(0S)",
"code": "0A",
"name": "普力马(海马)"
},
{
"host": "西雅特\n(0S)",
"code": "0B",
"name": "福美莱(海马)"
},
{
"host": "西雅特\n(0S)",
"code": "0E",
"name": "Ibiza"
},
{
"host": "重庆力帆(0T)",
"code": "0A",
"name": "520升级"
},
{
"host": "重庆力帆(0T)",
"code": "0B",
"name": "520升级(07款/10款/标准/出口/右舵/出租车)"
},
{
"host": "重庆力帆(0T)",
"code": "0C",
"name": "520升级(10款/基本/出口/出租车)"
},
{
"host": "重庆力帆(0T)",
"code": "0D",
"name": "微轿320(简配/俄罗斯版)/320新能源/7130"
},
{
"host": "重庆力帆(0T)",
"code": "0E",
"name": "7162(B级车)/620"
},
{
"host": "重庆力帆(0T)",
"code": "0F",
"name": "SUV/ X60"
},
{
"host": "重庆力帆(0T)",
"code": "0G",
"name": "720"
},
{
"host": "重庆力帆(0T)",
"code": "0H",
"name": "820"
},
{
"host": "重庆力帆(0T)",
"code": "0K",
"name": "650"
},
{
"host": "重庆力帆(0T)",
"code": "0L",
"name": "X80"
},
{
"host": "重庆力帆(0T)",
"code": "0M",
"name": "X40"
},
{
"host": "重庆力帆(0T)",
"code": "0N",
"name": "X60-16款"
},
{
"host": "重庆力帆(0T)",
"code": "0P",
"name": "CA10"
},
{
"host": "重庆力帆(0T)",
"code": "0Q",
"name": "CY02C"
},
{
"host": "重庆力帆(0T)",
"code": "0R",
"name": "X50"
},
{
"host": "比亚迪(0U)",
"code": "0A",
"name": "F3"
},
{
"host": "比亚迪(0U)",
"code": "1A",
"name": "SA2HA"
},
{
"host": "比亚迪(0U)",
"code": "2A",
"name": "HA3"
},
{
"host": "比亚迪(0U)",
"code": "3A",
"name": "MREBY"
},
{
"host": "比亚迪(0U)",
"code": "0B",
"name": "F3/F6"
},
{
"host": "比亚迪(0U)",
"code": "1B",
"name": "CP18B"
},
{
"host": "比亚迪(0U)",
"code": "2B",
"name": "平台件"
},
{
"host": "比亚迪(0U)",
"code": "3B",
"name": "STEBU"
},
{
"host": "比亚迪(0U)",
"code": "0C",
"name": "SA19"
},
{
"host": "比亚迪(0U)",
"code": "1C",
"name": "唐20（出口版）"
},
{
"host": "比亚迪(0U)",
"code": "2C",
"name": "SA3HKX"
},
{
"host": "比亚迪(0U)",
"code": "3C",
"name": "HA5H"
},
{
"host": "比亚迪(0U)",
"code": "0D",
"name": "ME"
},
{
"host": "比亚迪(0U)",
"code": "1D",
"name": "EKEA"
},
{
"host": "比亚迪(0U)",
"code": "2D",
"name": "SCEUA"
},
{
"host": "比亚迪(0U)",
"code": "0E",
"name": "SA2FC"
},
{
"host": "比亚迪(0U)",
"code": "1E",
"name": "MR"
},
{
"host": "比亚迪(0U)",
"code": "2E",
"name": "ER"
},
{
"host": "比亚迪(0U)",
"code": "0F",
"name": "HD"
},
{
"host": "比亚迪(0U)",
"code": "1F",
"name": "HCEF"
},
{
"host": "比亚迪(0U)",
"code": "2F",
"name": "EXEA"
},
{
"host": "比亚迪(0U)",
"code": "0G",
"name": "SA2H"
},
{
"host": "比亚迪(0U)",
"code": "1G",
"name": "HCEK\\EF\\EM\\EN\\HM\\HN\\HQ\\HS"
},
{
"host": "比亚迪(0U)",
"code": "2G",
"name": "UFEA"
},
{
"host": "比亚迪(0U)",
"code": "0H",
"name": "HADE"
},
{
"host": "比亚迪(0U)",
"code": "1H",
"name": "MARS"
},
{
"host": "比亚迪(0U)",
"code": "2H",
"name": "HX"
},
{
"host": "比亚迪(0U)",
"code": "0K",
"name": "EL"
},
{
"host": "比亚迪(0U)",
"code": "1K",
"name": "SG"
},
{
"host": "比亚迪(0U)",
"code": "2K",
"name": "HC2"
},
{
"host": "比亚迪(0U)",
"code": "0L",
"name": "SCED"
},
{
"host": "比亚迪(0U)",
"code": "1L",
"name": "UXE"
},
{
"host": "比亚迪(0U)",
"code": "2L",
"name": "SK2"
},
{
"host": "比亚迪(0U)",
"code": "0M",
"name": "HC /  STHN/HCHY/HCB/E"
},
{
"host": "比亚迪(0U)",
"code": "1M",
"name": "SCEU"
},
{
"host": "比亚迪(0U)",
"code": "2M",
"name": "UFE"
},
{
"host": "比亚迪(0U)",
"code": "0N",
"name": "HAD"
},
{
"host": "比亚迪(0U)",
"code": "1N",
"name": "EM2E"
},
{
"host": "比亚迪(0U)",
"code": "2N",
"name": "SA5"
},
{
"host": "比亚迪(0U)",
"code": "0P",
"name": "ST20"
},
{
"host": "比亚迪(0U)",
"code": "1P",
"name": "HA2E"
},
{
"host": "比亚迪(0U)",
"code": "2P",
"name": "HT&SZ"
},
{
"host": "比亚迪(0U)",
"code": "0Q",
"name": "MECC"
},
{
"host": "比亚迪(0U)",
"code": "1Q",
"name": "ESEA"
},
{
"host": "比亚迪(0U)",
"code": "2Q",
"name": "ST-23"
},
{
"host": "比亚迪(0U)",
"code": "0R",
"name": "SA3F"
},
{
"host": "比亚迪(0U)",
"code": "1R",
"name": "汉22款海外版"
},
{
"host": "比亚迪(0U)",
"code": "2R",
"name": "SA3EGU"
},
{
"host": "比亚迪(0U)",
"code": "0S",
"name": "SC2E"
},
{
"host": "比亚迪(0U)",
"code": "1S",
"name": "宋出口版"
},
{
"host": "比亚迪(0U)",
"code": "2S",
"name": "EREA"
},
{
"host": "比亚迪(0U)",
"code": "0T",
"name": "SA20/SA3/SA3E/SA3HE 出口"
},
{
"host": "比亚迪(0U)",
"code": "1T",
"name": "SU"
},
{
"host": "比亚迪(0U)",
"code": "2T",
"name": "HK"
},
{
"host": "比亚迪(0U)",
"code": "1U",
"name": "HXHA"
},
{
"host": "比亚迪(0U)",
"code": "2U",
"name": "SFH"
},
{
"host": "比亚迪(0U)",
"code": "0W",
"name": "3BFE"
},
{
"host": "比亚迪(0U)",
"code": "1W",
"name": "PA"
},
{
"host": "比亚迪(0U)",
"code": "2W",
"name": "UKEA"
},
{
"host": "比亚迪(0U)",
"code": "0X",
"name": "SCEJ/SCEL/SCEG/SCEM"
},
{
"host": "比亚迪(0U)",
"code": "1X",
"name": "SQ"
},
{
"host": "比亚迪(0U)",
"code": "2X",
"name": "SA2"
},
{
"host": "比亚迪(0U)",
"code": "0Y",
"name": "MEEC"
},
{
"host": "比亚迪(0U)",
"code": "1Y",
"name": "HC出口版"
},
{
"host": "比亚迪(0U)",
"code": "2Y",
"name": "SC3E"
},
{
"host": "比亚迪(0U)",
"code": "0Z",
"name": "SA2HG"
},
{
"host": "比亚迪(0U)",
"code": "1Z",
"name": "SA3出口版"
},
{
"host": "比亚迪(0U)",
"code": "2Z",
"name": "EM2EU"
},
{
"host": "青年汽车(0V)",
"code": "0A",
"name": "008/007(B/D/E)"
},
{
"host": "青年汽车(0V)",
"code": "0B",
"name": "007/007B&E1.8L"
},
{
"host": "青年汽车(0V)",
"code": "0C",
"name": "007D"
},
{
"host": "江淮\n(0W)",
"code": "0A",
"name": "株洲欧格瑞传动-T40轻卡"
},
{
"host": "江淮\n(0W)",
"code": "1A",
"name": "X811"
},
{
"host": "江淮\n(0W)",
"code": "0B",
"name": "江淮汽车S-II瑞风S5"
},
{
"host": "江淮\n(0W)",
"code": "1B",
"name": "P823"
},
{
"host": "江淮\n(0W)",
"code": "0C",
"name": "江淮汽车C-II"
},
{
"host": "江淮\n(0W)",
"code": "1C",
"name": "IS4"
},
{
"host": "江淮\n(0W)",
"code": "0D",
"name": "江淮汽车同悦/江淮M6瑞风/M6国六"
},
{
"host": "江淮\n(0W)",
"code": "1D",
"name": "江淮M4-2020款"
},
{
"host": "江淮\n(0W)",
"code": "0E",
"name": "江淮S3"
},
{
"host": "江淮\n(0W)",
"code": "1E",
"name": "X7"
},
{
"host": "江淮\n(0W)",
"code": "0F",
"name": "江淮M4"
},
{
"host": "江淮\n(0W)",
"code": "1F",
"name": "QXS811"
},
{
"host": "江淮\n(0W)",
"code": "0G",
"name": "江淮S7/IHEV S7/S7 2019/S7年度"
},
{
"host": "江淮\n(0W)",
"code": "1G",
"name": "U228Y"
},
{
"host": "江淮\n(0W)",
"code": "0H",
"name": "江淮S1"
},
{
"host": "江淮\n(0W)",
"code": "0K",
"name": "江淮S3-16款/S3-17款"
},
{
"host": "江淮\n(0W)",
"code": "0L",
"name": "江淮M432/M432拉菲版/A432/S432"
},
{
"host": "江淮\n(0W)",
"code": "0M",
"name": "江淮S3燃油版"
},
{
"host": "江淮\n(0W)",
"code": "0N",
"name": "江淮S5-16款"
},
{
"host": "江淮\n(0W)",
"code": "0P",
"name": "江淮M3/M3国六"
},
{
"host": "江淮\n(0W)",
"code": "0Q",
"name": "江淮A30"
},
{
"host": "江淮\n(0W)",
"code": "0R",
"name": "江淮S4/S4 出口/S4 2019/S4国六(S821)"
},
{
"host": "江淮\n(0W)",
"code": "0S",
"name": "江淮JV"
},
{
"host": "江淮\n(0W)",
"code": "0T",
"name": "江淮 IEV7T"
},
{
"host": "江淮\n(0W)",
"code": "0U",
"name": "M116"
},
{
"host": "江淮\n(0W)",
"code": "1U",
"name": "江淮S5(阿根廷版) /S5出口"
},
{
"host": "江淮\n(0W)",
"code": "0W",
"name": "IEVA60"
},
{
"host": "江淮\n(0W)",
"code": "0X",
"name": "M826"
},
{
"host": "江淮\n(0W)",
"code": "0Y",
"name": "IEVS4"
},
{
"host": "江淮\n(0W)",
"code": "0Z",
"name": "IEV6ES"
},
{
"host": "天津一汽(0X)",
"code": "0A",
"name": "夏利(C1/2000)"
},
{
"host": "通用汽车(0Y)",
"code": "0A",
"name": "美国通用"
},
{
"host": "通用汽车(0Y)",
"code": "1A",
"name": "A10 MY16"
},
{
"host": "通用汽车(0Y)",
"code": "2A",
"name": "358 MY20/358MY20.5/358MY20.75/358 MY21/358 MY22/358 MY22.25/358-2 MY24/SGM 358-2 MY23/358 MY22.5/SGM 358-2 MY24"
},
{
"host": "通用汽车(0Y)",
"code": "3A",
"name": "L234 MY25"
},
{
"host": "通用汽车(0Y)",
"code": "4A",
"name": "C1YC-2 S MY25"
},
{
"host": "通用汽车(0Y)",
"code": "5A",
"name": "NDSC"
},
{
"host": "通用汽车(0Y)",
"code": "0B",
"name": "T car"
},
{
"host": "通用汽车(0Y)",
"code": "1B",
"name": "上汽通用五菱 GP50/51"
},
{
"host": "通用汽车(0Y)",
"code": "2B",
"name": "k229/K229 MY21"
},
{
"host": "通用汽车(0Y)",
"code": "3B",
"name": "C1TL MY24"
},
{
"host": "通用汽车(0Y)",
"code": "4B",
"name": "NDSC MY26"
},
{
"host": "通用汽车(0Y)",
"code": "0C",
"name": "L car"
},
{
"host": "通用汽车(0Y)",
"code": "1C",
"name": "E2LB/E2LB MY20/E2LB-2/E2LB-2 MY24"
},
{
"host": "通用汽车(0Y)",
"code": "2C",
"name": "JCCC"
},
{
"host": "通用汽车(0Y)",
"code": "3C",
"name": "L233 MY24"
},
{
"host": "通用汽车(0Y)",
"code": "4C",
"name": "SGM 358-2PHEV MY25"
},
{
"host": "通用汽车(0Y)",
"code": "0D",
"name": "SGM710/711/D15"
},
{
"host": "通用汽车(0Y)",
"code": "1D",
"name": "SGM358"
},
{
"host": "通用汽车(0Y)",
"code": "2D",
"name": "TBD（未正式定点，只提供样件）"
},
{
"host": "通用汽车(0Y)",
"code": "3D",
"name": "JBUC MY24"
},
{
"host": "通用汽车(0Y)",
"code": "4D",
"name": "358-2 PHEV"
},
{
"host": "通用汽车(0Y)",
"code": "0E",
"name": "通用印度I-163/MY11 police car/Holden VE"
},
{
"host": "通用汽车(0Y)",
"code": "1E",
"name": "308 MY14.5"
},
{
"host": "通用汽车(0Y)",
"code": "2E",
"name": "Global BG SGM E2QL-2"
},
{
"host": "通用汽车(0Y)",
"code": "3E",
"name": "C1UL-2 MY25"
},
{
"host": "通用汽车(0Y)",
"code": "4E",
"name": "GMI-700"
},
{
"host": "通用汽车(0Y)",
"code": "0F",
"name": "SGM201(MCE)/SGM E11"
},
{
"host": "通用汽车(0Y)",
"code": "1F",
"name": "308MY15"
},
{
"host": "通用汽车(0Y)",
"code": "2F",
"name": "GL8"
},
{
"host": "通用汽车(0Y)",
"code": "3F",
"name": "C223"
},
{
"host": "通用汽车(0Y)",
"code": "4F",
"name": "B233 MY25"
},
{
"host": "通用汽车(0Y)",
"code": "0G",
"name": "SGM18"
},
{
"host": "通用汽车(0Y)",
"code": "1G",
"name": "SGM328"
},
{
"host": "通用汽车(0Y)",
"code": "2G",
"name": "JBNC(海外通用）"
},
{
"host": "通用汽车(0Y)",
"code": "3G",
"name": "358L MY25"
},
{
"host": "通用汽车(0Y)",
"code": "4G",
"name": "NDLB"
},
{
"host": "通用汽车(0Y)",
"code": "0H",
"name": "SGM E11"
},
{
"host": "通用汽车(0Y)",
"code": "1H",
"name": "K216"
},
{
"host": "通用汽车(0Y)",
"code": "2H",
"name": "SGM 458/SGM 458 MY23"
},
{
"host": "通用汽车(0Y)",
"code": "3H",
"name": "SGM JCSB MY25"
},
{
"host": "通用汽车(0Y)",
"code": "0K",
"name": "SGM308/308右舵"
},
{
"host": "通用汽车(0Y)",
"code": "1K",
"name": "SGM D01"
},
{
"host": "通用汽车(0Y)",
"code": "2K",
"name": "L233-S"
},
{
"host": "通用汽车(0Y)",
"code": "3K",
"name": "SGM 358-2 MY25"
},
{
"host": "通用汽车(0Y)",
"code": "0L",
"name": "SGM258/SGM258 13MY   /SGM258 Legacy ICS/SGM258L MCM (MY21)/258MY21.5 /258 MY21.75 /258L MY21.85/258L MY22/MY23/258L MY22.5"
},
{
"host": "通用汽车(0Y)",
"code": "1L",
"name": "上汽通用五菱\nGP30"
},
{
"host": "通用汽车(0Y)",
"code": "2L",
"name": "CIUC 23MY"
},
{
"host": "通用汽车(0Y)",
"code": "3L",
"name": "458HEV MY25"
},
{
"host": "通用汽车(0Y)",
"code": "0M",
"name": "SGM985/SGM200"
},
{
"host": "通用汽车(0Y)",
"code": "1M",
"name": "K256/K256 MY19/K256 MY21/K256 MY20"
},
{
"host": "通用汽车(0Y)",
"code": "2M",
"name": "B233/B233 MY24"
},
{
"host": "通用汽车(0Y)",
"code": "3M",
"name": "BTILY MY25"
},
{
"host": "通用汽车(0Y)",
"code": "0N",
"name": "SGM D11"
},
{
"host": "通用汽车(0Y)",
"code": "1N",
"name": "K221"
},
{
"host": "通用汽车(0Y)",
"code": "2N",
"name": "B223/B223 MY24"
},
{
"host": "通用汽车(0Y)",
"code": "3N",
"name": "L246 MY24"
},
{
"host": "通用汽车(0Y)",
"code": "0P",
"name": "E16/GMX353/V"
},
{
"host": "通用汽车(0Y)",
"code": "1P",
"name": "D2SC"
},
{
"host": "通用汽车(0Y)",
"code": "2P",
"name": "L233RHD"
},
{
"host": "通用汽车(0Y)",
"code": "3P",
"name": "358L（48V+HEV）"
},
{
"host": "通用汽车(0Y)",
"code": "0Q",
"name": "SGM818雪佛兰景程下一代"
},
{
"host": "通用汽车(0Y)",
"code": "1Q",
"name": "GEM NBHB/JBUC MY22/JBSC1 UZ/JBUC Argentina/JBSC 墨西哥/JBUC 巴西/JBUC MY23&24"
},
{
"host": "通用汽车(0Y)",
"code": "2Q",
"name": "L246"
},
{
"host": "通用汽车(0Y)",
"code": "3Q",
"name": "SGM558 MY25"
},
{
"host": "通用汽车(0Y)",
"code": "0R",
"name": "SGM615/SGMK211"
},
{
"host": "通用汽车(0Y)",
"code": "1R",
"name": "K226"
},
{
"host": "通用汽车(0Y)",
"code": "2R",
"name": "D2UC-2 S/D2UC-2"
},
{
"host": "通用汽车(0Y)",
"code": "3R",
"name": "258L MY23"
},
{
"host": "通用汽车(0Y)",
"code": "0S",
"name": "M300"
},
{
"host": "通用汽车(0Y)",
"code": "1S",
"name": "GEM BSUV"
},
{
"host": "通用汽车(0Y)",
"code": "2S",
"name": "E2UB MCM/E2UB"
},
{
"host": "通用汽车(0Y)",
"code": "3S",
"name": "E2LB-2 MY25"
},
{
"host": "通用汽车(0Y)",
"code": "0T",
"name": "NGL358"
},
{
"host": "通用汽车(0Y)",
"code": "1T",
"name": "K257/K257 MY20/K257 MY19"
},
{
"host": "通用汽车(0Y)",
"code": "2T",
"name": "E2YB MCM"
},
{
"host": "通用汽车(0Y)",
"code": "3T",
"name": "K228 MY24/K228 MY23.75/K228 MY23.65"
},
{
"host": "通用汽车(0Y)",
"code": "2U",
"name": "C234 MY24"
},
{
"host": "通用汽车(0Y)",
"code": "3U",
"name": "K218 MY24.5"
},
{
"host": "通用汽车(0Y)",
"code": "0W",
"name": "EPSILON"
},
{
"host": "通用汽车(0Y)",
"code": "1W",
"name": "GEM C-CAR/JCSB MY22/JCSB MY23"
},
{
"host": "通用汽车(0Y)",
"code": "2W",
"name": "L232 MY24"
},
{
"host": "通用汽车(0Y)",
"code": "3W",
"name": "C1YB-2 S"
},
{
"host": "通用汽车(0Y)",
"code": "0X",
"name": "SGM A10"
},
{
"host": "通用汽车(0Y)",
"code": "1X",
"name": "K228/K228 MY22"
},
{
"host": "通用汽车(0Y)",
"code": "2X",
"name": "K218/K218 MY22/K218 MY23"
},
{
"host": "通用汽车(0Y)",
"code": "0Y",
"name": "E17/E17 MY17"
},
{
"host": "通用汽车(0Y)",
"code": "1Y",
"name": "K227"
},
{
"host": "通用汽车(0Y)",
"code": "2Y",
"name": "SGM 458 HEV MY25"
},
{
"host": "通用汽车(0Y)",
"code": "3Y",
"name": "C1YC-2 MY25"
},
{
"host": "通用汽车(0Y)",
"code": "0Z",
"name": "SGM 308 MY14出口"
},
{
"host": "通用汽车(0Y)",
"code": "1Z",
"name": "C1UB-S/C1UBS MY20"
},
{
"host": "通用汽车(0Y)",
"code": "2Z",
"name": "L234 MY24"
},
{
"host": "通用汽车(0Y)",
"code": "3Z",
"name": "C1YC-2 S"
},
{
"host": "郑州日产\n(0Z)",
"code": "0A",
"name": "DK4-3/2007/长春海拉"
},
{
"host": "郑州日产\n(0Z)",
"code": "0B",
"name": "V01/B"
},
{
"host": "郑州日产\n(0Z)",
"code": "0C",
"name": "东风柳汽 重卡H7"
},
{
"host": "郑州日产\n(0Z)",
"code": "0D",
"name": "郑州日产 帅客(电动车)"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0A",
"name": "X760L"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0B",
"name": "X540 18MY"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0C",
"name": "L551"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0D",
"name": "L550 20MY/L550 21MY/L550 22MY"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0E",
"name": "X760 20MY/X760 21MY"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0F",
"name": "X540 20MY"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0G",
"name": "X260 21MY/X261 22MY"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0H",
"name": "L551 EWB 21MY/L551 22MY"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0K",
"name": "X540 23MY"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0L",
"name": "X760L 23MY"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0M",
"name": "L550 24MY"
},
{
"host": "奇瑞捷豹路虎(AA)",
"code": "0N",
"name": "L551 24MY"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0A",
"name": "ES8"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0B",
"name": "ES6/ES8/EC6"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0C",
"name": "ES8+18"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0D",
"name": "ET7"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0E",
"name": "ES6+12"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0F",
"name": "force"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0G",
"name": "Gemini"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0H",
"name": "Aries"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0K",
"name": "Lyra"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0L",
"name": "Force G1.3"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0M",
"name": "Force G1.F"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0N",
"name": "VELA"
},
{
"host": "蔚来汽车\nNEXTEV(AB)",
"code": "0P",
"name": "LEO"
},
{
"host": "宝沃汽车\n(AC)",
"code": "0A",
"name": "S701"
},
{
"host": "宝沃汽车\n(AC)",
"code": "0B",
"name": "S600"
},
{
"host": "宝沃汽车\n(AC)",
"code": "0C",
"name": "S700TS"
},
{
"host": "宝沃汽车\n(AC)",
"code": "0D",
"name": "S700 19MY/S700 MCE"
},
{
"host": "宝沃汽车\n(AC)",
"code": "0E",
"name": "S500MCE"
},
{
"host": "上汽大通(AD)",
"code": "0A",
"name": "EV78"
},
{
"host": "上汽大通(AD)",
"code": "1A",
"name": "MPV"
},
{
"host": "上汽大通(AD)",
"code": "0B",
"name": "SV51/SV51-C1/EV51-Q3/SV51-01/SV51-03"
},
{
"host": "上汽大通(AD)",
"code": "1B",
"name": "SK83-B2"
},
{
"host": "上汽大通(AD)",
"code": "0C",
"name": "EV31/EV31-C1"
},
{
"host": "上汽大通(AD)",
"code": "1C",
"name": "SV52"
},
{
"host": "上汽大通(AD)",
"code": "0D",
"name": "SK83/SK83-B1/SK83 右舵"
},
{
"host": "上汽大通(AD)",
"code": "1D",
"name": "EV63-23MY海外"
},
{
"host": "上汽大通(AD)",
"code": "0E",
"name": "SV73"
},
{
"host": "上汽大通(AD)",
"code": "1E",
"name": "EKK1"
},
{
"host": "上汽大通(AD)",
"code": "0F",
"name": "SV63&EV63-24MY/EV65"
},
{
"host": "上汽大通(AD)",
"code": "1F",
"name": "SV7"
},
{
"host": "上汽大通(AD)",
"code": "0G",
"name": "MIFA/MIFA-EV-5RNV/MIFA-SPX1/ MIFA-EPX1-B1/SV91-B1"
},
{
"host": "上汽大通(AD)",
"code": "1G",
"name": "MILA"
},
{
"host": "上汽大通(AD)",
"code": "0H",
"name": "SPX1"
},
{
"host": "上汽大通(AD)",
"code": "1H",
"name": "SKK1"
},
{
"host": "上汽大通(AD)",
"code": "0K",
"name": "SK82"
},
{
"host": "上汽大通(AD)",
"code": "1K",
"name": "SV51-D2"
},
{
"host": "上汽大通(AD)",
"code": "0L",
"name": "SV63房车"
},
{
"host": "上汽大通(AD)",
"code": "1L",
"name": "SV71-D1"
},
{
"host": "上汽大通(AD)",
"code": "0M",
"name": "SV71-D4/SV71-D5/SV71-22MY"
},
{
"host": "上汽大通(AD)",
"code": "1M",
"name": "EV52"
},
{
"host": "上汽大通(AD)",
"code": "0N",
"name": "RV63C"
},
{
"host": "上汽大通(AD)",
"code": "1N",
"name": "SV91"
},
{
"host": "上汽大通(AD)",
"code": "0P",
"name": "EK89"
},
{
"host": "上汽大通(AD)",
"code": "1P",
"name": "MIFA-PHEV/52-PHEV"
},
{
"host": "上汽大通(AD)",
"code": "0Q",
"name": "X100"
},
{
"host": "上汽大通(AD)",
"code": "1Q",
"name": "EV31 24MY"
},
{
"host": "上汽大通(AD)",
"code": "0R",
"name": "SV91-B1"
},
{
"host": "上汽大通(AD)",
"code": "1R",
"name": "R63C"
},
{
"host": "上汽大通(AD)",
"code": "0S",
"name": "红岩L2++"
},
{
"host": "上汽大通(AD)",
"code": "1S",
"name": "MIFA 24MY"
},
{
"host": "上汽大通(AD)",
"code": "0T",
"name": "SV71 MIX"
},
{
"host": "上汽大通(AD)",
"code": "1T",
"name": "GST"
},
{
"host": "上汽大通(AD)",
"code": "0U",
"name": "SPC1-A1"
},
{
"host": "上汽大通(AD)",
"code": "1U",
"name": "SV65 V1"
},
{
"host": "上汽大通(AD)",
"code": "0W",
"name": "SV91 22MY"
},
{
"host": "上汽大通(AD)",
"code": "1W",
"name": "SK81"
},
{
"host": "上汽大通(AD)",
"code": "0X",
"name": "SV61"
},
{
"host": "上汽大通(AD)",
"code": "0Y",
"name": "SPC1&EPC1"
},
{
"host": "上汽大通(AD)",
"code": "0Z",
"name": "SV65"
},
{
"host": "东风\n小康(AE)",
"code": "0A",
"name": "F517/F517改款/F517全新内饰"
},
{
"host": "东风\n小康(AE)",
"code": "0B",
"name": "F537/F537改款"
},
{
"host": "东风\n小康(AE)",
"code": "0C",
"name": "E513/E513改款"
},
{
"host": "东风\n小康(AE)",
"code": "0D",
"name": "F513/F513改款"
},
{
"host": "东风\n小康(AE)",
"code": "0E",
"name": "F527/F527高配"
},
{
"host": "东风\n小康(AE)",
"code": "0F",
"name": "580全新内饰/580红星版"
},
{
"host": "东风\n小康(AE)",
"code": "0G",
"name": "F537动力升级"
},
{
"host": "东风\n小康(AE)",
"code": "0H",
"name": "F507"
},
{
"host": "东风\n小康(AE)",
"code": "0K",
"name": "F537全新内饰"
},
{
"host": "东风\n小康(AE)",
"code": "0L",
"name": "580"
},
{
"host": "东风\n小康(AE)",
"code": "0M",
"name": "F537EVR"
},
{
"host": "东风\n小康(AE)",
"code": "0N",
"name": "F527EVR"
},
{
"host": "东风\n小康(AE)",
"code": "0P",
"name": "F517EVR"
},
{
"host": "东风\n小康(AE)",
"code": "0Q",
"name": "F537海外版"
},
{
"host": "东风\n小康(AE)",
"code": "0R",
"name": "S513EVR"
},
{
"host": "东风\n小康(AE)",
"code": "0S",
"name": "F505V"
},
{
"host": "东风\n小康(AE)",
"code": "0T",
"name": "F508"
},
{
"host": "东风\n小康(AE)",
"code": "0U",
"name": "S508"
},
{
"host": "东风\n小康(AE)",
"code": "0W",
"name": "新E3"
},
{
"host": "东风\n小康(AE)",
"code": "0X",
"name": "N91"
},
{
"host": "东风\n小康(AE)",
"code": "0Y",
"name": "F517海外款"
},
{
"host": "观致\n(AF)",
"code": "0A",
"name": "CF1X平台"
},
{
"host": "观致\n(AF)",
"code": "0B",
"name": "C26/C26 1.5T"
},
{
"host": "观致\n(AF)",
"code": "0C",
"name": "C21"
},
{
"host": "观致\n(AF)",
"code": "0D",
"name": "C6M0"
},
{
"host": "SKODA\n(AG)",
"code": "0A",
"name": "Fabia"
},
{
"host": "SKODA\n(AG)",
"code": "0B",
"name": "科迪亚克 NF"
},
{
"host": "理想汽车\n(AH)",
"code": "0A",
"name": "M01/MO1B"
},
{
"host": "理想汽车\n(AH)",
"code": "0B",
"name": "X01/X02/X03"
},
{
"host": "理想汽车\n(AH)",
"code": "0C",
"name": "W01"
},
{
"host": "理想汽车\n(AH)",
"code": "0D",
"name": "X04"
},
{
"host": "理想汽车\n(AH)",
"code": "0E",
"name": "X01B/X02B/X03B"
},
{
"host": "理想汽车\n(AH)",
"code": "0F",
"name": "W02/W03"
},
{
"host": "大乘汽车\n(AK)",
"code": "0A",
"name": "FZA11"
},
{
"host": "大乘汽车\n(AK)",
"code": "0B",
"name": "JTB10"
},
{
"host": "大乘汽车\n(AK)",
"code": "0C",
"name": "P51"
},
{
"host": "爱驰亿维(AL)",
"code": "0A",
"name": "MAS861"
},
{
"host": "爱驰亿维(AL)",
"code": "0B",
"name": "MAS8613"
},
{
"host": "爱驰亿维(AL)",
"code": "0C",
"name": "MAS8613T"
},
{
"host": "悦达起亚(原名东风悦达起亚)(AM)",
"code": "0A",
"name": "DL3C/DL3C PE"
},
{
"host": "悦达起亚(原名东风悦达起亚)(AM)",
"code": "0B",
"name": "NQ5C&NQ5C HEV"
},
{
"host": "悦达起亚(原名东风悦达起亚)(AM)",
"code": "0C",
"name": "BCD PE"
},
{
"host": "悦达起亚(原名东风悦达起亚)(AM)",
"code": "0D",
"name": "QYC项目"
},
{
"host": "悦达起亚(原名东风悦达起亚)(AM)",
"code": "0E",
"name": "CL4C"
},
{
"host": "小鹏汽车(AN)",
"code": "0A",
"name": "E28/E28V"
},
{
"host": "小鹏汽车(AN)",
"code": "0B",
"name": "D21"
},
{
"host": "小鹏汽车(AN)",
"code": "0C",
"name": "D55"
},
{
"host": "小鹏汽车(AN)",
"code": "0D",
"name": "F30"
},
{
"host": "小鹏汽车(AN)",
"code": "0E",
"name": "H93"
},
{
"host": "长安福特(AP)",
"code": "0A",
"name": "CD542&CDX754"
},
{
"host": "长安福特(AP)",
"code": "0B",
"name": "CX482"
},
{
"host": "长安福特(AP)",
"code": "0C",
"name": "CD539"
},
{
"host": "长安福特(AP)",
"code": "0D",
"name": "CD764"
},
{
"host": "长安福特(AP)",
"code": "0E",
"name": "U625/U625 ICA"
},
{
"host": "长安福特(AP)",
"code": "0F",
"name": "U611 ICA"
},
{
"host": "长安福特(AP)",
"code": "0G",
"name": "CDX706"
},
{
"host": "长安福特(AP)",
"code": "0H",
"name": "CX727"
},
{
"host": "长安福特(AP)",
"code": "0K",
"name": "CDX707"
},
{
"host": "长安福特(AP)",
"code": "0L",
"name": "CX788"
},
{
"host": "长安福特(AP)",
"code": "0M",
"name": "CX483"
},
{
"host": "长安福特(AP)",
"code": "0N",
"name": "U611MCA"
},
{
"host": "长安福特(AP)",
"code": "0P",
"name": "CX821"
},
{
"host": "长安福特(AP)",
"code": "0Q",
"name": "U625MCA"
},
{
"host": "长安福特(AP)",
"code": "0R",
"name": "CX821C"
},
{
"host": "长安福特(AP)",
"code": "0S",
"name": "CX821N"
},
{
"host": "长安福特(AP)",
"code": "0T",
"name": "CDX707N"
},
{
"host": "长安福特(AP)",
"code": "0U",
"name": "CD542 ICA"
},
{
"host": "博郡汽车(AQ)",
"code": "0A",
"name": "B31"
},
{
"host": "广汽丰田(AR)",
"code": "0A",
"name": "A26-T"
},
{
"host": "凯翼汽车(AT)",
"code": "0A",
"name": "FX11/FX11E/FX11国际"
},
{
"host": "凯翼汽车(AT)",
"code": "0B",
"name": "FX11-M01/M01EV"
},
{
"host": "凯翼汽车(AT)",
"code": "0C",
"name": "GS11"
},
{
"host": "凯翼汽车(AT)",
"code": "0D",
"name": "GS11 MY"
},
{
"host": "凯翼汽车(AT)",
"code": "0E",
"name": "GS11 CBU"
},
{
"host": "凯翼汽车(AT)",
"code": "0F",
"name": "M01-KD"
},
{
"host": "凯翼汽车(AT)",
"code": "0G",
"name": "GS11-ZY"
},
{
"host": "凯翼汽车(AT)",
"code": "0H",
"name": "GS11-KD"
},
{
"host": "凯翼汽车(AT)",
"code": "0K",
"name": "HH11"
},
{
"host": "凯翼汽车(AT)",
"code": "0L",
"name": "GS11-BEV"
},
{
"host": "赛力斯汽车（原名金康新能源）（AU)",
"code": "0A",
"name": "S513EVR"
},
{
"host": "赛力斯汽车（原名金康新能源）（AU)",
"code": "0B",
"name": "S306B"
},
{
"host": "赛力斯汽车（原名金康新能源）（AU)",
"code": "0C",
"name": "S513"
},
{
"host": "赛力斯汽车（原名金康新能源）（AU)",
"code": "0D",
"name": "X1/F1/X1EV"
},
{
"host": "赛力斯汽车（原名金康新能源）（AU)",
"code": "0E",
"name": "F2"
},
{
"host": "赛力斯汽车（原名金康新能源）（AU)",
"code": "0F",
"name": "HM7"
},
{
"host": "华人运通（AW)",
"code": "0A",
"name": "VX1"
},
{
"host": "华人运通（AW)",
"code": "0B",
"name": "HA1"
},
{
"host": "华人运通（AW)",
"code": "0C",
"name": "VX1-MCE"
},
{
"host": "华人运通（AW)",
"code": "0D",
"name": "VC1"
},
{
"host": "华人运通（AW)",
"code": "0E",
"name": "VC1出行版"
},
{
"host": "江铃汽车（AX)",
"code": "0A",
"name": "CX756/CX756/CX756/CX756-GAS+PHEV"
},
{
"host": "江铃汽车（AX)",
"code": "0B",
"name": "CX743MCAPHEV/CX743MCA/CX743"
},
{
"host": "江铃汽车（AX)",
"code": "0C",
"name": "N600/N900/N800"
},
{
"host": "江铃汽车（AX)",
"code": "0D",
"name": "V348MCA2"
},
{
"host": "江铃汽车（AX)",
"code": "0E",
"name": "T521/V362MCA"
},
{
"host": "江铃汽车（AX)",
"code": "0F",
"name": "EKS"
},
{
"host": "江铃汽车（AX)",
"code": "0G",
"name": "JP512 EX"
},
{
"host": "江铃汽车（AX)",
"code": "0H",
"name": "T360"
},
{
"host": "江铃汽车（AX)",
"code": "0K",
"name": "A121027"
},
{
"host": "江铃汽车（AX)",
"code": "0L",
"name": "P789"
},
{
"host": "江铃汽车（AX)",
"code": "0M",
"name": "CX756 MCA FHEV&&EKS2 FHEV"
},
{
"host": "江铃汽车（AX)",
"code": "0N",
"name": "JP512"
},
{
"host": "江铃汽车（AX)",
"code": "0P",
"name": "JP360"
},
{
"host": "江铃汽车（AX)",
"code": "0Q",
"name": "CX835 REEV"
},
{
"host": "江铃汽车（AX)",
"code": "0R",
"name": "CX756MCA PHEV&EKS PHEV"
},
{
"host": "江铃汽车（AX)",
"code": "0S",
"name": "JP523"
},
{
"host": "东风乘用车（AY)",
"code": "0A",
"name": "D53/D53EV/D58"
},
{
"host": "东风乘用车（AY)",
"code": "0B",
"name": "PZ1G"
},
{
"host": "韩国现代AZ",
"code": "0A",
"name": "US4"
},
{
"host": "韩国现代AZ",
"code": "0B",
"name": "JW/JW1"
},
{
"host": "韩国现代AZ",
"code": "0C",
"name": "US4 HEV"
},
{
"host": "韩国现代AZ",
"code": "0D",
"name": "TSD A01"
},
{
"host": "韩国现代AZ",
"code": "0E",
"name": "JW PE"
},
{
"host": "岚图\nBA",
"code": "0A",
"name": "H97"
},
{
"host": "岚图\nBA",
"code": "0B",
"name": "H56"
},
{
"host": "岚图\nBA",
"code": "0C",
"name": "H53"
},
{
"host": "岚图\nBA",
"code": "0D",
"name": "H97C"
},
{
"host": "岚图\nBA",
"code": "0E",
"name": "H56Z"
},
{
"host": "岚图\nBA",
"code": "0F",
"name": "H56B"
},
{
"host": "岚图\nBA",
"code": "0G",
"name": "H56C"
},
{
"host": "广汽本田BB",
"code": "0A",
"name": "A26-H"
},
{
"host": "广汽三菱BC",
"code": "0A",
"name": "RE"
},
{
"host": "广汽三菱BC",
"code": "0B",
"name": "LE"
},
{
"host": "戴姆勒BD",
"code": "0A",
"name": "LRV5"
},
{
"host": "戴姆勒BD",
"code": "0B",
"name": "EQ"
},
{
"host": "宝能汽车BE",
"code": "0A",
"name": "GX16"
},
{
"host": "特斯拉BF",
"code": "0A",
"name": "NV94"
},
{
"host": "特斯拉BF",
"code": "0B",
"name": "GF3"
},
{
"host": "特斯拉BF",
"code": "0C",
"name": "Model Y"
},
{
"host": "特斯拉BF",
"code": "0D",
"name": "Highland"
},
{
"host": "特斯拉BF",
"code": "0E",
"name": "Model X"
},
{
"host": "特斯拉BF",
"code": "0F",
"name": "Cybertruck"
},
{
"host": "捷豹路虎全球BG",
"code": "0A",
"name": "X152/L550 22MY/L551 22MY/X540 22MY/L560/X260/X260 SB/X260 LCN/X760/X760 LCN/X761/X590/L462/L461 22MY/L460/L663 22MY/X391/L392 22MY/X393/1460 ESS/L461 ESS/L550/L552/X540"
},
{
"host": "捷豹路虎全球BG",
"code": "0B",
"name": "L481&L384&L383"
},
{
"host": "捷豹路虎全球BG",
"code": "0C",
"name": "L663 25MY SV"
},
{
"host": "捷豹路虎全球BG",
"code": "0D",
"name": "L663 SV D90"
},
{
"host": "捷豹路虎全球BG",
"code": "0E",
"name": "EMA & Panthera"
},
{
"host": "捷豹路虎全球BG",
"code": "0F",
"name": "MLA-H, JAG BEV, EMA"
},
{
"host": "捷豹路虎全球BG",
"code": "0G",
"name": "L460 SV 26MY"
},
{
"host": "捷豹路虎全球BG",
"code": "0H",
"name": "TVM"
},
{
"host": "捷豹路虎全球BG",
"code": "0K",
"name": "L462 23MY/L460/L461 24MY"
},
{
"host": "广汽菲亚特克莱斯勒汽车有限公司(广汽菲克)BH",
"code": "0A",
"name": "A12-F"
},
{
"host": "Stellantis Group  BK",
"code": "0A",
"name": "CDPO+ BPilot"
},
{
"host": "Stellantis Group  BK",
"code": "0B",
"name": "P64 E/P64,P74,OV64,CR3,D74"
},
{
"host": "Stellantis Group  BK",
"code": "0C",
"name": "JL"
},
{
"host": "Stellantis Group  BK",
"code": "0D",
"name": "Smart Car项目，CC21,CC24,OV24车型"
},
{
"host": "Stellantis Group  BK",
"code": "0E",
"name": "L21"
},
{
"host": "小桔  BL",
"code": "0A",
"name": "D1-Life"
},
{
"host": "小桔  BL",
"code": "0B",
"name": "Mona"
},
{
"host": "小桔  BL",
"code": "0C",
"name": "Alita"
},
{
"host": "合创汽车BM",
"code": "0A",
"name": "GN05"
},
{
"host": "合创汽车BM",
"code": "0B",
"name": "G06"
},
{
"host": "合创汽车BM",
"code": "0C",
"name": "G08"
},
{
"host": "合创汽车BM",
"code": "0D",
"name": "G05"
},
{
"host": "智己汽车BN",
"code": "0A",
"name": "S11L"
},
{
"host": "智己汽车BN",
"code": "0B",
"name": "P11L"
},
{
"host": "智己汽车BN",
"code": "0C",
"name": "S12L"
},
{
"host": "智己汽车BN",
"code": "0D",
"name": "P11L M2"
},
{
"host": "智己汽车BN",
"code": "0E",
"name": "P12L"
},
{
"host": "智己汽车BN",
"code": "0F",
"name": "S11L-M1"
},
{
"host": "智己汽车BN",
"code": "0G",
"name": "P11L X1"
},
{
"host": "大众安徽BP",
"code": "0A",
"name": "POC"
},
{
"host": "大众安徽BP",
"code": "1A",
"name": "Tavascan"
},
{
"host": "大众安徽BP",
"code": "1B",
"name": "A COS e/A NB"
},
{
"host": "广汽新能源BQ",
"code": "0A",
"name": "X66"
},
{
"host": "广汽新能源BQ",
"code": "1A",
"name": "A21/A02"
},
{
"host": "广汽新能源BQ",
"code": "0B",
"name": "A18-Z"
},
{
"host": "广汽新能源BQ",
"code": "1B",
"name": "A18-V"
},
{
"host": "广汽新能源BQ",
"code": "0C",
"name": "A29-G"
},
{
"host": "广汽新能源BQ",
"code": "1C",
"name": "A13-K"
},
{
"host": "广汽新能源BQ",
"code": "1D",
"name": "AS9"
},
{
"host": "广汽新能源BQ",
"code": "1E",
"name": "AH8"
},
{
"host": "广汽新能源BQ",
"code": "1F",
"name": "A29-V"
},
{
"host": "广汽新能源BQ",
"code": "1G",
"name": "A19"
},
{
"host": "广汽新能源BQ",
"code": "1H",
"name": "A29-V右舵"
},
{
"host": "李尔汽车BR",
"code": "1A",
"name": "V254"
},
{
"host": "集度汽车\nBS",
"code": "0A",
"name": "Venus"
},
{
"host": "集度汽车\nBS",
"code": "1A",
"name": "Mars 1"
},
{
"host": "东风本田\nBT",
"code": "1A",
"name": "DB2"
},
{
"host": "奇瑞新能源\nBU",
"code": "0A",
"name": "M1AFL1中亚"
},
{
"host": "奇瑞新能源\nBU",
"code": "1A",
"name": "M1AEVFL1"
},
{
"host": "北汽新能源BV",
"code": "1A",
"name": "N61AB"
},
{
"host": "北汽新能源BV",
"code": "1B",
"name": "N61-M10"
},
{
"host": "北汽新能源BV",
"code": "1C",
"name": "C46DB"
},
{
"host": "北汽新能源BV",
"code": "1D",
"name": "C71KB F01"
},
{
"host": "合众新能源\nBW",
"code": "1A",
"name": "EP40"
},
{
"host": "合众新能源\nBW",
"code": "1B",
"name": "EP36"
},
{
"host": "智马达\nBX",
"code": "1A",
"name": "HY11"
},
{
"host": "智马达\nBX",
"code": "1B",
"name": "HX11"
},
{
"host": "君趣汽车\nBY",
"code": "1A",
"name": "B41"
},
{
"host": "百度阿波罗\nBZ",
"code": "1A",
"name": "RT6"
},
{
"host": "零跑汽车\nCA",
"code": "1A",
"name": "C11"
},
{
"host": "零跑汽车\nCA",
"code": "1B",
"name": "B11/B01"
},
{
"host": "零跑汽车\nCA",
"code": "1C",
"name": "B11EV10A"
},
{
"host": "吉祥汽车\nCB",
"code": "0A",
"name": "Y331"
},
{
"host": "吉祥汽车\nCB",
"code": "1A",
"name": "C5"
},
{
"host": "青岛北汽制造厂\nCC",
"code": "1A",
"name": "YB101"
},
{
"host": "南京依维柯\nCH",
"code": "0A",
"name": "欧胜"
}
]

/** 产品类型代码字典（附表3，74 条，忠实原文） */
export const PRODUCT_TYPE_CODES: ProductTypeCode[] = [
{
"code": "01",
"name": "中控面板、娱乐面板（不含空调操作,不含触摸屏）",
"alias": "多功能控制面板"
},
{
"code": "02",
"name": "空调模块",
"alias": "黑盒子（控制器）、热管理控制模块"
},
{
"code": "03",
"name": "后面板，后娱乐面板（不含空调操作,不含触摸屏）",
"alias": ""
},
{
"code": "04",
"name": "前空调面板（不含触摸屏，按键主体依赖结构而非虚拟软件界面，具备AC、风量、前除雾、温度、吹风模式这些典型空调控制按钮或旋钮）",
"alias": "前空调控制器(触控电动)/空调控制面板"
},
{
"code": "05",
"name": "后空调面板（不含触摸屏，按键主体依赖结构而非虚拟软件界面）",
"alias": ""
},
{
"code": "06",
"name": "电子油泵",
"alias": ""
},
{
"code": "07",
"name": "电动窗+后视镜开关总成（=72+31）",
"alias": ""
},
{
"code": "08",
"name": "多媒体主机/娱乐主机",
"alias": "家居控制"
},
{
"code": "09",
"name": "网关",
"alias": ""
},
{
"code": "10",
"name": "BCM",
"alias": "车身控制模块\n隐藏式门把手控制器模块"
},
{
"code": "11",
"name": "雷达",
"alias": ""
},
{
"code": "12",
"name": "ABS开关",
"alias": ""
},
{
"code": "13",
"name": "大灯开关，大灯调节+灯光调节开关总成，",
"alias": ""
},
{
"code": "14",
"name": "车载充电模块/DCDC",
"alias": ""
},
{
"code": "15",
"name": "传感器",
"alias": "遥控器"
},
{
"code": "16",
"name": "前顶灯/后顶灯/二排顶灯/三排顶灯",
"alias": "护目灯"
},
{
"code": "17",
"name": "离合器开关/制动灯开关/制动组合开关",
"alias": ""
},
{
"code": "18",
"name": "娱乐显示屏/前排屏",
"alias": ""
},
{
"code": "19",
"name": "仪表显示屏",
"alias": ""
},
{
"code": "20",
"name": "双联屏",
"alias": ""
},
{
"code": "21",
"name": "三联屏",
"alias": ""
},
{
"code": "22",
"name": "多联屏",
"alias": ""
},
{
"code": "23",
"name": "后排屏",
"alias": "吸顶屏"
},
{
"code": "24",
"name": "差速锁控制模块",
"alias": ""
},
{
"code": "25",
"name": "数据记录仪",
"alias": ""
},
{
"code": "26",
"name": "换档器（无面板）",
"alias": "电子换档、怀档"
},
{
"code": "27",
"name": "换档面板",
"alias": ""
},
{
"code": "28",
"name": "冷暖杯托",
"alias": "冷热杯托"
},
{
"code": "31",
"name": "后视镜开关/电动后视镜开关",
"alias": ""
},
{
"code": "32",
"name": "盖板/护板/安装板（将电子/结构/平台字母用于区分，另表描述。有表面效果要求）",
"alias": "老板椅开关盖板，详见另外单独表格"
},
{
"code": "33",
"name": "衣帽钩（若纯塑料件将电子/结构/平台字母用于区分）",
"alias": "详见另外单独表格"
},
{
"code": "34",
"name": "开关堵盖（无功能）/换挡球头（无电功能：将电子/结构/平台字母用于区分；有电功能按球头的电子特征命名）",
"alias": "详见另外单独表格"
},
{
"code": "35",
"name": "门灯开关/脚步照明灯开关/门接触开关，（非人手操作的开关，由位置触发工作）",
"alias": "座椅外侧扶手外侧一键解锁开关总成"
},
{
"code": "36",
"name": "前雾灯开关/后雾灯开关",
"alias": ""
},
{
"code": "37",
"name": "线束（将电子/结构/平台字母用于区分）",
"alias": "详见另外单独表格"
},
{
"code": "38",
"name": "香氛发生器",
"alias": ""
},
{
"code": "39",
"name": "香氛弹",
"alias": ""
},
{
"code": "40",
"name": "域控制器",
"alias": "ZCU"
},
{
"code": "41",
"name": "抬头显示控制器",
"alias": ""
},
{
"code": "43",
"name": "指示灯/脚照明灯/LAMP-FOOTWELL/氛围灯",
"alias": "安全带未系警示器"
},
{
"code": "44",
"name": "单功能开关(非1-43，45-99定义的单功能开关)",
"alias": "充电口小门开关、电动门开关"
},
{
"code": "45",
"name": "开关组（左仪表区）",
"alias": "控制开关总成"
},
{
"code": "46",
"name": "开关组（中控区）",
"alias": "控制开关总成"
},
{
"code": "47",
"name": "开关组（中通道区）",
"alias": "四驱开关总成/控制开关总成"
},
{
"code": "48",
"name": "开关组（门上）",
"alias": "左前门开关总成、开关电动门开关、车外输入开关总成、车外密码输入开关"
},
{
"code": "49",
"name": "开关组（非45-48区域）",
"alias": "拖车钩开关键+底盘升降按键、后排放倒按键+底盘升降按键"
},
{
"code": "52",
"name": "组合开关（方盘柱上的)",
"alias": "转向柱开关"
},
{
"code": "53",
"name": "一键启动开关",
"alias": ""
},
{
"code": "54",
"name": "模式切换开关",
"alias": "运动/节能/舒适驾驶开关/电动四驱开关"
},
{
"code": "55",
"name": "EPB(电子驻车)开关",
"alias": "EPB开关带面板总成/驻车制动开关"
},
{
"code": "56",
"name": "AutoHold(驻车保持)开关/驻车保持+EPB(电子驻车)开关",
"alias": ""
},
{
"code": "58",
"name": "座椅加热开关",
"alias": ""
},
{
"code": "61",
"name": "开关组(座椅)（含63+64）",
"alias": ""
},
{
"code": "62",
"name": "后备门开关/后盖开关/油箱盖开关",
"alias": "行李箱油箱盖开关/行李箱开关"
},
{
"code": "63",
"name": "座椅调节开关/腰托/老板键/按摩开关",
"alias": "座椅开关旋钮/电动座椅调节开关/座椅座垫调节/驾驶员座椅靠背调节按钮/副驾驶员座椅腿托调节控制器/座椅靠背后部一键解锁开关/座椅滑轨电动解锁开关"
},
{
"code": "64",
"name": "座椅记忆开关",
"alias": ""
},
{
"code": "65",
"name": "按钮（纯塑料件）（将电子/结构/平台字母用于区分）",
"alias": "老板椅开关盖板"
},
{
"code": "66",
"name": "摄像头",
"alias": "驾驶员监控系统摄像头\n环视摄像头\n倒车摄像头"
},
{
"code": "67",
"name": "摄像头支架（将电子/结构/平台字母用于区分）/开关支架（无表面要求）",
"alias": ""
},
{
"code": "69",
"name": "天窗开关，窗帘开关，遮阳帘开关",
"alias": ""
},
{
"code": "70",
"name": "车窗控制模块",
"alias": ""
},
{
"code": "71",
"name": "单电动窗开关/副司机门电动窗开关(有护板放到变形里)/移门开关",
"alias": "后排车窗升降开关/单门电动窗开关/门玻璃升降器开关/副电动窗开关/后电动窗开关/后门玻璃升降器开关/"
},
{
"code": "72",
"name": "司机门电动窗开关总成(有护板放到变形里)",
"alias": "主电动窗开关/左前门集控开关"
},
{
"code": "73",
"name": "报警灯开关/警报灯开关",
"alias": "救援呼叫开关"
},
{
"code": "77",
"name": "中控锁开关",
"alias": "门锁开关"
},
{
"code": "83",
"name": "PLA(自动泊车)开关",
"alias": ""
},
{
"code": "84",
"name": "PDC(辅助停车)开关",
"alias": ""
},
{
"code": "86",
"name": "手套箱灯开关",
"alias": ""
},
{
"code": "90",
"name": "辅助驾驶系统控制器/全景驾驶控制器",
"alias": "摄像头及其控制器"
},
{
"code": "95",
"name": "方向盘调节开关",
"alias": "转向盘调节开关"
},
{
"code": "96",
"name": "左方向盘开关",
"alias": "方向盘巡航开关"
},
{
"code": "97",
"name": "右方向盘开关",
"alias": "方向盘娱乐开关"
},
{
"code": "98",
"name": "左+右方向盘开关（包括含换档拨片一起作成品供货的）",
"alias": ""
},
{
"code": "99",
"name": "方向盘换档拨片开关",
"alias": "左侧换挡拨片/右侧换挡拨片"
}
]

/** 纯结构件技术特征（附表4，6 类产品类型，忠实原文） */
export const STRUCT_TYPE_BLOCKS: StructTypeBlock[] = [
{
"typeCode": "32",
"typeName": "盖板/护板/安装板（将电子/结构/平台字母用于区分）",
"entries": [
{
"region": "左仪表区",
"code": "000",
"name": ""
},
{
"region": "中控区",
"code": "100",
"name": "AI盖板"
},
{
"region": "中通道区",
"code": "200",
"name": "中通道区的装饰件"
},
{
"region": "门上",
"code": "300",
"name": "主驾玻璃升降开关安装板"
},
{
"region": "椅上",
"code": "400",
"name": "左前座椅后排可调节开关面板"
},
{
"region": "仪表上",
"code": "500",
"name": "仪表屏支架总成"
},
{
"region": "顶上",
"code": "600",
"name": "吸顶屏装饰罩"
},
{
"region": "方向柱及方向盘上",
"code": "700",
"name": "方向盘开关安装板"
},
{
"region": "不可见区",
"code": "800",
"name": ""
},
{
"region": "左仪表区",
"code": "001",
"name": ""
},
{
"region": "中控区",
"code": "101",
"name": "EPB开关安装面板"
},
{
"region": "中通道区",
"code": "201",
"name": ""
},
{
"region": "门上",
"code": "301",
"name": "副驾玻璃升降开关安装板"
},
{
"region": "椅上",
"code": "401",
"name": ""
},
{
"region": "仪表上",
"code": "501",
"name": ""
},
{
"region": "顶上",
"code": "601",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "701",
"name": ""
},
{
"region": "不可见区",
"code": "801",
"name": ""
},
{
"region": "左仪表区",
"code": "002",
"name": ""
},
{
"region": "中控区",
"code": "102",
"name": ""
},
{
"region": "中通道区",
"code": "202",
"name": ""
},
{
"region": "门上",
"code": "302",
"name": "左后玻璃升降开关安装板"
},
{
"region": "椅上",
"code": "402",
"name": ""
},
{
"region": "仪表上",
"code": "502",
"name": ""
},
{
"region": "顶上",
"code": "602",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "702",
"name": ""
},
{
"region": "不可见区",
"code": "802",
"name": ""
},
{
"region": "左仪表区",
"code": "003",
"name": ""
},
{
"region": "中控区",
"code": "103",
"name": ""
},
{
"region": "中通道区",
"code": "203",
"name": ""
},
{
"region": "门上",
"code": "303",
"name": "右后玻璃升降开关安装板"
},
{
"region": "椅上",
"code": "403",
"name": ""
},
{
"region": "仪表上",
"code": "503",
"name": ""
},
{
"region": "顶上",
"code": "603",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "703",
"name": ""
},
{
"region": "不可见区",
"code": "803",
"name": ""
},
{
"region": "左仪表区",
"code": "004",
"name": ""
},
{
"region": "中控区",
"code": "104",
"name": ""
},
{
"region": "中通道区",
"code": "204",
"name": ""
},
{
"region": "门上",
"code": "304",
"name": ""
},
{
"region": "椅上",
"code": "404",
"name": ""
},
{
"region": "仪表上",
"code": "504",
"name": ""
},
{
"region": "顶上",
"code": "604",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "704",
"name": ""
},
{
"region": "不可见区",
"code": "804",
"name": ""
},
{
"region": "左仪表区",
"code": "005",
"name": ""
},
{
"region": "中控区",
"code": "105",
"name": ""
},
{
"region": "中通道区",
"code": "205",
"name": ""
},
{
"region": "门上",
"code": "305",
"name": ""
},
{
"region": "椅上",
"code": "405",
"name": ""
},
{
"region": "仪表上",
"code": "505",
"name": ""
},
{
"region": "顶上",
"code": "605",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "705",
"name": ""
},
{
"region": "不可见区",
"code": "805",
"name": ""
},
{
"region": "左仪表区",
"code": "006",
"name": ""
},
{
"region": "中控区",
"code": "106",
"name": ""
},
{
"region": "中通道区",
"code": "206",
"name": ""
},
{
"region": "门上",
"code": "306",
"name": ""
},
{
"region": "椅上",
"code": "406",
"name": ""
},
{
"region": "仪表上",
"code": "506",
"name": ""
},
{
"region": "顶上",
"code": "606",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "706",
"name": ""
},
{
"region": "不可见区",
"code": "806",
"name": ""
},
{
"region": "左仪表区",
"code": "007",
"name": ""
},
{
"region": "中控区",
"code": "107",
"name": ""
},
{
"region": "中通道区",
"code": "207",
"name": ""
},
{
"region": "门上",
"code": "307",
"name": ""
},
{
"region": "椅上",
"code": "407",
"name": ""
},
{
"region": "仪表上",
"code": "507",
"name": ""
},
{
"region": "顶上",
"code": "607",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "707",
"name": ""
},
{
"region": "不可见区",
"code": "807",
"name": ""
},
{
"region": "左仪表区",
"code": "008",
"name": ""
},
{
"region": "中控区",
"code": "108",
"name": ""
},
{
"region": "中通道区",
"code": "208",
"name": ""
},
{
"region": "门上",
"code": "308",
"name": ""
},
{
"region": "椅上",
"code": "408",
"name": ""
},
{
"region": "仪表上",
"code": "508",
"name": ""
},
{
"region": "顶上",
"code": "608",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "708",
"name": ""
},
{
"region": "不可见区",
"code": "808",
"name": ""
},
{
"region": "左仪表区",
"code": "009",
"name": ""
},
{
"region": "中控区",
"code": "109",
"name": ""
},
{
"region": "中通道区",
"code": "209",
"name": ""
},
{
"region": "门上",
"code": "309",
"name": ""
},
{
"region": "椅上",
"code": "409",
"name": ""
},
{
"region": "仪表上",
"code": "509",
"name": ""
},
{
"region": "顶上",
"code": "609",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "709",
"name": ""
},
{
"region": "不可见区",
"code": "809",
"name": ""
},
{
"region": "左仪表区",
"code": "010",
"name": ""
},
{
"region": "中控区",
"code": "110",
"name": ""
},
{
"region": "中通道区",
"code": "210",
"name": ""
},
{
"region": "门上",
"code": "310",
"name": ""
},
{
"region": "椅上",
"code": "410",
"name": ""
},
{
"region": "仪表上",
"code": "510",
"name": ""
},
{
"region": "顶上",
"code": "610",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "710",
"name": ""
},
{
"region": "不可见区",
"code": "810",
"name": ""
},
{
"region": "左仪表区",
"code": "011",
"name": ""
},
{
"region": "中控区",
"code": "111",
"name": ""
},
{
"region": "中通道区",
"code": "211",
"name": ""
},
{
"region": "门上",
"code": "311",
"name": ""
},
{
"region": "椅上",
"code": "411",
"name": ""
},
{
"region": "仪表上",
"code": "511",
"name": ""
},
{
"region": "顶上",
"code": "611",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "711",
"name": ""
},
{
"region": "不可见区",
"code": "811",
"name": ""
},
{
"region": "左仪表区",
"code": "012",
"name": ""
},
{
"region": "中控区",
"code": "112",
"name": ""
},
{
"region": "中通道区",
"code": "212",
"name": ""
},
{
"region": "门上",
"code": "312",
"name": ""
},
{
"region": "椅上",
"code": "412",
"name": ""
},
{
"region": "仪表上",
"code": "512",
"name": ""
},
{
"region": "顶上",
"code": "612",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "712",
"name": ""
},
{
"region": "不可见区",
"code": "812",
"name": ""
},
{
"region": "左仪表区",
"code": "013",
"name": ""
},
{
"region": "中控区",
"code": "113",
"name": ""
},
{
"region": "中通道区",
"code": "213",
"name": ""
},
{
"region": "门上",
"code": "313",
"name": ""
},
{
"region": "椅上",
"code": "413",
"name": ""
},
{
"region": "仪表上",
"code": "513",
"name": ""
},
{
"region": "顶上",
"code": "613",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "713",
"name": ""
},
{
"region": "不可见区",
"code": "813",
"name": ""
},
{
"region": "左仪表区",
"code": "014",
"name": ""
},
{
"region": "中控区",
"code": "114",
"name": ""
},
{
"region": "中通道区",
"code": "214",
"name": ""
},
{
"region": "门上",
"code": "314",
"name": ""
},
{
"region": "椅上",
"code": "414",
"name": ""
},
{
"region": "仪表上",
"code": "514",
"name": ""
},
{
"region": "顶上",
"code": "614",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "714",
"name": ""
},
{
"region": "不可见区",
"code": "814",
"name": ""
},
{
"region": "左仪表区",
"code": "015",
"name": ""
},
{
"region": "中控区",
"code": "115",
"name": ""
},
{
"region": "中通道区",
"code": "215",
"name": ""
},
{
"region": "门上",
"code": "315",
"name": ""
},
{
"region": "椅上",
"code": "415",
"name": ""
},
{
"region": "仪表上",
"code": "515",
"name": ""
},
{
"region": "顶上",
"code": "615",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "715",
"name": ""
},
{
"region": "不可见区",
"code": "815",
"name": ""
},
{
"region": "左仪表区",
"code": "016",
"name": ""
},
{
"region": "中控区",
"code": "116",
"name": ""
},
{
"region": "中通道区",
"code": "216",
"name": ""
},
{
"region": "门上",
"code": "316",
"name": ""
},
{
"region": "椅上",
"code": "416",
"name": ""
},
{
"region": "仪表上",
"code": "516",
"name": ""
},
{
"region": "顶上",
"code": "616",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "716",
"name": ""
},
{
"region": "不可见区",
"code": "816",
"name": ""
},
{
"region": "左仪表区",
"code": "017",
"name": ""
},
{
"region": "中控区",
"code": "117",
"name": ""
},
{
"region": "中通道区",
"code": "217",
"name": ""
},
{
"region": "门上",
"code": "317",
"name": ""
},
{
"region": "椅上",
"code": "417",
"name": ""
},
{
"region": "仪表上",
"code": "517",
"name": ""
},
{
"region": "顶上",
"code": "617",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "717",
"name": ""
},
{
"region": "不可见区",
"code": "817",
"name": ""
},
{
"region": "左仪表区",
"code": "018",
"name": ""
},
{
"region": "中控区",
"code": "118",
"name": ""
},
{
"region": "中通道区",
"code": "218",
"name": ""
},
{
"region": "门上",
"code": "318",
"name": ""
},
{
"region": "椅上",
"code": "418",
"name": ""
},
{
"region": "仪表上",
"code": "518",
"name": ""
},
{
"region": "顶上",
"code": "618",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "718",
"name": ""
},
{
"region": "不可见区",
"code": "818",
"name": ""
},
{
"region": "椅上",
"code": "419",
"name": ""
},
{
"region": "椅上",
"code": "420",
"name": "老板键罩盖"
}
]
},
{
"typeCode": "33",
"typeName": "衣帽钩（将电子/结构/平台字母用于区分）",
"entries": [
{
"region": "左仪表区",
"code": "000",
"name": "衣帽钩装饰圈"
},
{
"region": "中控区",
"code": "100",
"name": ""
},
{
"region": "中通道区",
"code": "200",
"name": ""
},
{
"region": "门上",
"code": "300",
"name": ""
},
{
"region": "椅上",
"code": "400",
"name": ""
},
{
"region": "仪表上",
"code": "500",
"name": ""
},
{
"region": "顶上",
"code": "600",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "700",
"name": ""
},
{
"region": "不可见区",
"code": "800",
"name": ""
},
{
"region": "左仪表区",
"code": "001",
"name": ""
},
{
"region": "中控区",
"code": "101",
"name": ""
},
{
"region": "中通道区",
"code": "201",
"name": "换档按钮套"
},
{
"region": "门上",
"code": "301",
"name": ""
},
{
"region": "椅上",
"code": "401",
"name": ""
},
{
"region": "仪表上",
"code": "501",
"name": ""
},
{
"region": "顶上",
"code": "601",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "701",
"name": ""
},
{
"region": "不可见区",
"code": "801",
"name": ""
},
{
"region": "左仪表区",
"code": "002",
"name": ""
},
{
"region": "中控区",
"code": "102",
"name": ""
},
{
"region": "中通道区",
"code": "202",
"name": ""
},
{
"region": "门上",
"code": "302",
"name": ""
},
{
"region": "椅上",
"code": "402",
"name": ""
},
{
"region": "仪表上",
"code": "502",
"name": ""
},
{
"region": "顶上",
"code": "602",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "702",
"name": ""
},
{
"region": "不可见区",
"code": "802",
"name": ""
},
{
"region": "左仪表区",
"code": "003",
"name": ""
},
{
"region": "中控区",
"code": "103",
"name": ""
},
{
"region": "中通道区",
"code": "203",
"name": ""
},
{
"region": "门上",
"code": "303",
"name": ""
},
{
"region": "椅上",
"code": "403",
"name": ""
},
{
"region": "仪表上",
"code": "503",
"name": ""
},
{
"region": "顶上",
"code": "603",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "703",
"name": ""
},
{
"region": "不可见区",
"code": "803",
"name": ""
},
{
"region": "左仪表区",
"code": "004",
"name": ""
},
{
"region": "中控区",
"code": "104",
"name": ""
},
{
"region": "中通道区",
"code": "204",
"name": ""
},
{
"region": "门上",
"code": "304",
"name": ""
},
{
"region": "椅上",
"code": "404",
"name": ""
},
{
"region": "仪表上",
"code": "504",
"name": ""
},
{
"region": "顶上",
"code": "604",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "704",
"name": ""
},
{
"region": "不可见区",
"code": "804",
"name": ""
},
{
"region": "左仪表区",
"code": "005",
"name": ""
},
{
"region": "中控区",
"code": "105",
"name": ""
},
{
"region": "中通道区",
"code": "205",
"name": ""
},
{
"region": "门上",
"code": "305",
"name": ""
},
{
"region": "椅上",
"code": "405",
"name": ""
},
{
"region": "仪表上",
"code": "505",
"name": ""
},
{
"region": "顶上",
"code": "605",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "705",
"name": ""
},
{
"region": "不可见区",
"code": "805",
"name": ""
},
{
"region": "左仪表区",
"code": "006",
"name": ""
},
{
"region": "中控区",
"code": "106",
"name": ""
},
{
"region": "中通道区",
"code": "206",
"name": ""
},
{
"region": "门上",
"code": "306",
"name": ""
},
{
"region": "椅上",
"code": "406",
"name": ""
},
{
"region": "仪表上",
"code": "506",
"name": ""
},
{
"region": "顶上",
"code": "606",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "706",
"name": ""
},
{
"region": "不可见区",
"code": "806",
"name": ""
},
{
"region": "左仪表区",
"code": "007",
"name": ""
},
{
"region": "中控区",
"code": "107",
"name": ""
},
{
"region": "中通道区",
"code": "207",
"name": ""
},
{
"region": "门上",
"code": "307",
"name": ""
},
{
"region": "椅上",
"code": "407",
"name": ""
},
{
"region": "仪表上",
"code": "507",
"name": ""
},
{
"region": "顶上",
"code": "607",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "707",
"name": ""
},
{
"region": "不可见区",
"code": "807",
"name": ""
},
{
"region": "左仪表区",
"code": "008",
"name": ""
},
{
"region": "中控区",
"code": "108",
"name": ""
},
{
"region": "中通道区",
"code": "208",
"name": ""
},
{
"region": "门上",
"code": "308",
"name": ""
},
{
"region": "椅上",
"code": "408",
"name": ""
},
{
"region": "仪表上",
"code": "508",
"name": ""
},
{
"region": "顶上",
"code": "608",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "708",
"name": ""
},
{
"region": "不可见区",
"code": "808",
"name": ""
},
{
"region": "左仪表区",
"code": "009",
"name": ""
},
{
"region": "中控区",
"code": "109",
"name": ""
},
{
"region": "中通道区",
"code": "209",
"name": ""
},
{
"region": "门上",
"code": "309",
"name": ""
},
{
"region": "椅上",
"code": "409",
"name": ""
},
{
"region": "仪表上",
"code": "509",
"name": ""
},
{
"region": "顶上",
"code": "609",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "709",
"name": ""
},
{
"region": "不可见区",
"code": "809",
"name": ""
},
{
"region": "左仪表区",
"code": "010",
"name": ""
},
{
"region": "中控区",
"code": "110",
"name": ""
},
{
"region": "中通道区",
"code": "210",
"name": ""
},
{
"region": "门上",
"code": "310",
"name": ""
},
{
"region": "椅上",
"code": "410",
"name": ""
},
{
"region": "仪表上",
"code": "510",
"name": ""
},
{
"region": "顶上",
"code": "610",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "710",
"name": ""
},
{
"region": "不可见区",
"code": "810",
"name": ""
},
{
"region": "左仪表区",
"code": "011",
"name": ""
},
{
"region": "中控区",
"code": "111",
"name": ""
},
{
"region": "中通道区",
"code": "211",
"name": ""
},
{
"region": "门上",
"code": "311",
"name": ""
},
{
"region": "椅上",
"code": "411",
"name": ""
},
{
"region": "仪表上",
"code": "511",
"name": ""
},
{
"region": "顶上",
"code": "611",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "711",
"name": ""
},
{
"region": "不可见区",
"code": "811",
"name": ""
},
{
"region": "左仪表区",
"code": "012",
"name": ""
},
{
"region": "中控区",
"code": "112",
"name": ""
},
{
"region": "中通道区",
"code": "212",
"name": ""
},
{
"region": "门上",
"code": "312",
"name": ""
},
{
"region": "椅上",
"code": "412",
"name": ""
},
{
"region": "仪表上",
"code": "512",
"name": ""
},
{
"region": "顶上",
"code": "612",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "712",
"name": ""
},
{
"region": "不可见区",
"code": "812",
"name": ""
},
{
"region": "左仪表区",
"code": "013",
"name": ""
},
{
"region": "中控区",
"code": "113",
"name": ""
},
{
"region": "中通道区",
"code": "213",
"name": ""
},
{
"region": "门上",
"code": "313",
"name": ""
},
{
"region": "椅上",
"code": "413",
"name": ""
},
{
"region": "仪表上",
"code": "513",
"name": ""
},
{
"region": "顶上",
"code": "613",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "713",
"name": ""
},
{
"region": "不可见区",
"code": "813",
"name": ""
},
{
"region": "左仪表区",
"code": "014",
"name": ""
},
{
"region": "中控区",
"code": "114",
"name": ""
},
{
"region": "中通道区",
"code": "214",
"name": ""
},
{
"region": "门上",
"code": "314",
"name": ""
},
{
"region": "椅上",
"code": "414",
"name": ""
},
{
"region": "仪表上",
"code": "514",
"name": ""
},
{
"region": "顶上",
"code": "614",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "714",
"name": ""
},
{
"region": "不可见区",
"code": "814",
"name": ""
},
{
"region": "左仪表区",
"code": "015",
"name": ""
},
{
"region": "中控区",
"code": "115",
"name": ""
},
{
"region": "中通道区",
"code": "215",
"name": ""
},
{
"region": "门上",
"code": "315",
"name": ""
},
{
"region": "椅上",
"code": "415",
"name": ""
},
{
"region": "仪表上",
"code": "515",
"name": ""
},
{
"region": "顶上",
"code": "615",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "715",
"name": ""
},
{
"region": "不可见区",
"code": "815",
"name": ""
},
{
"region": "左仪表区",
"code": "016",
"name": ""
},
{
"region": "中控区",
"code": "116",
"name": ""
},
{
"region": "中通道区",
"code": "216",
"name": ""
},
{
"region": "门上",
"code": "316",
"name": ""
},
{
"region": "椅上",
"code": "416",
"name": ""
},
{
"region": "仪表上",
"code": "516",
"name": ""
},
{
"region": "顶上",
"code": "616",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "716",
"name": ""
},
{
"region": "不可见区",
"code": "816",
"name": ""
},
{
"region": "左仪表区",
"code": "017",
"name": ""
},
{
"region": "中控区",
"code": "117",
"name": ""
},
{
"region": "中通道区",
"code": "217",
"name": ""
},
{
"region": "门上",
"code": "317",
"name": ""
},
{
"region": "椅上",
"code": "417",
"name": ""
},
{
"region": "仪表上",
"code": "517",
"name": ""
},
{
"region": "顶上",
"code": "617",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "717",
"name": ""
},
{
"region": "不可见区",
"code": "817",
"name": ""
},
{
"region": "左仪表区",
"code": "018",
"name": ""
},
{
"region": "中控区",
"code": "118",
"name": ""
},
{
"region": "中通道区",
"code": "218",
"name": ""
},
{
"region": "门上",
"code": "318",
"name": ""
},
{
"region": "椅上",
"code": "418",
"name": ""
},
{
"region": "仪表上",
"code": "518",
"name": ""
},
{
"region": "顶上",
"code": "618",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "718",
"name": ""
},
{
"region": "不可见区",
"code": "818",
"name": ""
}
]
},
{
"typeCode": "34",
"typeName": "开关堵盖（无功能）/换挡球头（将电子/结构/平台字母用于区分）",
"entries": [
{
"region": "左仪表区",
"code": "000",
"name": ""
},
{
"region": "中控区",
"code": "100",
"name": ""
},
{
"region": "中通道区",
"code": "200",
"name": ""
},
{
"region": "门上",
"code": "300",
"name": "车后微动开关安装堵盖"
},
{
"region": "椅上",
"code": "400",
"name": ""
},
{
"region": "仪表上",
"code": "500",
"name": ""
},
{
"region": "顶上",
"code": "600",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "700",
"name": ""
},
{
"region": "不可见区",
"code": "800",
"name": ""
},
{
"region": "左仪表区",
"code": "001",
"name": "开关堵盖"
},
{
"region": "中控区",
"code": "101",
"name": ""
},
{
"region": "中通道区",
"code": "201",
"name": ""
},
{
"region": "门上",
"code": "301",
"name": "中控锁开关堵盖"
},
{
"region": "椅上",
"code": "401",
"name": ""
},
{
"region": "仪表上",
"code": "501",
"name": ""
},
{
"region": "顶上",
"code": "601",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "701",
"name": ""
},
{
"region": "不可见区",
"code": "801",
"name": ""
},
{
"region": "左仪表区",
"code": "002",
"name": ""
},
{
"region": "中控区",
"code": "102",
"name": ""
},
{
"region": "中通道区",
"code": "202",
"name": ""
},
{
"region": "门上",
"code": "302",
"name": ""
},
{
"region": "椅上",
"code": "402",
"name": ""
},
{
"region": "仪表上",
"code": "502",
"name": ""
},
{
"region": "顶上",
"code": "602",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "702",
"name": ""
},
{
"region": "不可见区",
"code": "802",
"name": ""
},
{
"region": "左仪表区",
"code": "003",
"name": ""
},
{
"region": "中控区",
"code": "103",
"name": ""
},
{
"region": "中通道区",
"code": "203",
"name": ""
},
{
"region": "门上",
"code": "303",
"name": ""
},
{
"region": "椅上",
"code": "403",
"name": ""
},
{
"region": "仪表上",
"code": "503",
"name": ""
},
{
"region": "顶上",
"code": "603",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "703",
"name": ""
},
{
"region": "不可见区",
"code": "803",
"name": ""
},
{
"region": "左仪表区",
"code": "004",
"name": ""
},
{
"region": "中控区",
"code": "104",
"name": ""
},
{
"region": "中通道区",
"code": "204",
"name": ""
},
{
"region": "门上",
"code": "304",
"name": ""
},
{
"region": "椅上",
"code": "404",
"name": ""
},
{
"region": "仪表上",
"code": "504",
"name": ""
},
{
"region": "顶上",
"code": "604",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "704",
"name": ""
},
{
"region": "不可见区",
"code": "804",
"name": ""
},
{
"region": "左仪表区",
"code": "005",
"name": ""
},
{
"region": "中控区",
"code": "105",
"name": ""
},
{
"region": "中通道区",
"code": "205",
"name": ""
},
{
"region": "门上",
"code": "305",
"name": ""
},
{
"region": "椅上",
"code": "405",
"name": ""
},
{
"region": "仪表上",
"code": "505",
"name": ""
},
{
"region": "顶上",
"code": "605",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "705",
"name": ""
},
{
"region": "不可见区",
"code": "805",
"name": ""
},
{
"region": "左仪表区",
"code": "006",
"name": ""
},
{
"region": "中控区",
"code": "106",
"name": ""
},
{
"region": "中通道区",
"code": "206",
"name": ""
},
{
"region": "门上",
"code": "306",
"name": ""
},
{
"region": "椅上",
"code": "406",
"name": ""
},
{
"region": "仪表上",
"code": "506",
"name": ""
},
{
"region": "顶上",
"code": "606",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "706",
"name": ""
},
{
"region": "不可见区",
"code": "806",
"name": ""
},
{
"region": "左仪表区",
"code": "007",
"name": ""
},
{
"region": "中控区",
"code": "107",
"name": ""
},
{
"region": "中通道区",
"code": "207",
"name": ""
},
{
"region": "门上",
"code": "307",
"name": ""
},
{
"region": "椅上",
"code": "407",
"name": ""
},
{
"region": "仪表上",
"code": "507",
"name": ""
},
{
"region": "顶上",
"code": "607",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "707",
"name": ""
},
{
"region": "不可见区",
"code": "807",
"name": ""
},
{
"region": "左仪表区",
"code": "008",
"name": ""
},
{
"region": "中控区",
"code": "108",
"name": ""
},
{
"region": "中通道区",
"code": "208",
"name": ""
},
{
"region": "门上",
"code": "308",
"name": ""
},
{
"region": "椅上",
"code": "408",
"name": ""
},
{
"region": "仪表上",
"code": "508",
"name": ""
},
{
"region": "顶上",
"code": "608",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "708",
"name": ""
},
{
"region": "不可见区",
"code": "808",
"name": ""
},
{
"region": "左仪表区",
"code": "009",
"name": ""
},
{
"region": "中控区",
"code": "109",
"name": ""
},
{
"region": "中通道区",
"code": "209",
"name": ""
},
{
"region": "门上",
"code": "309",
"name": ""
},
{
"region": "椅上",
"code": "409",
"name": ""
},
{
"region": "仪表上",
"code": "509",
"name": ""
},
{
"region": "顶上",
"code": "609",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "709",
"name": ""
},
{
"region": "不可见区",
"code": "809",
"name": ""
},
{
"region": "左仪表区",
"code": "010",
"name": ""
},
{
"region": "中控区",
"code": "110",
"name": ""
},
{
"region": "中通道区",
"code": "210",
"name": ""
},
{
"region": "门上",
"code": "310",
"name": ""
},
{
"region": "椅上",
"code": "410",
"name": ""
},
{
"region": "仪表上",
"code": "510",
"name": ""
},
{
"region": "顶上",
"code": "610",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "710",
"name": ""
},
{
"region": "不可见区",
"code": "810",
"name": ""
},
{
"region": "左仪表区",
"code": "011",
"name": ""
},
{
"region": "中控区",
"code": "111",
"name": ""
},
{
"region": "中通道区",
"code": "211",
"name": ""
},
{
"region": "门上",
"code": "311",
"name": ""
},
{
"region": "椅上",
"code": "411",
"name": ""
},
{
"region": "仪表上",
"code": "511",
"name": ""
},
{
"region": "顶上",
"code": "611",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "711",
"name": ""
},
{
"region": "不可见区",
"code": "811",
"name": ""
},
{
"region": "左仪表区",
"code": "012",
"name": ""
},
{
"region": "中控区",
"code": "112",
"name": ""
},
{
"region": "中通道区",
"code": "212",
"name": ""
},
{
"region": "门上",
"code": "312",
"name": ""
},
{
"region": "椅上",
"code": "412",
"name": ""
},
{
"region": "仪表上",
"code": "512",
"name": ""
},
{
"region": "顶上",
"code": "612",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "712",
"name": ""
},
{
"region": "不可见区",
"code": "812",
"name": ""
},
{
"region": "左仪表区",
"code": "013",
"name": ""
},
{
"region": "中控区",
"code": "113",
"name": ""
},
{
"region": "中通道区",
"code": "213",
"name": ""
},
{
"region": "门上",
"code": "313",
"name": ""
},
{
"region": "椅上",
"code": "413",
"name": ""
},
{
"region": "仪表上",
"code": "513",
"name": ""
},
{
"region": "顶上",
"code": "613",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "713",
"name": ""
},
{
"region": "不可见区",
"code": "813",
"name": ""
},
{
"region": "左仪表区",
"code": "014",
"name": ""
},
{
"region": "中控区",
"code": "114",
"name": ""
},
{
"region": "中通道区",
"code": "214",
"name": ""
},
{
"region": "门上",
"code": "314",
"name": ""
},
{
"region": "椅上",
"code": "414",
"name": ""
},
{
"region": "仪表上",
"code": "514",
"name": ""
},
{
"region": "顶上",
"code": "614",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "714",
"name": ""
},
{
"region": "不可见区",
"code": "814",
"name": ""
},
{
"region": "左仪表区",
"code": "015",
"name": ""
},
{
"region": "中控区",
"code": "115",
"name": ""
},
{
"region": "中通道区",
"code": "215",
"name": ""
},
{
"region": "门上",
"code": "315",
"name": ""
},
{
"region": "椅上",
"code": "415",
"name": ""
},
{
"region": "仪表上",
"code": "515",
"name": ""
},
{
"region": "顶上",
"code": "615",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "715",
"name": ""
},
{
"region": "不可见区",
"code": "815",
"name": ""
},
{
"region": "左仪表区",
"code": "016",
"name": ""
},
{
"region": "中控区",
"code": "116",
"name": ""
},
{
"region": "中通道区",
"code": "216",
"name": ""
},
{
"region": "门上",
"code": "316",
"name": ""
},
{
"region": "椅上",
"code": "416",
"name": ""
},
{
"region": "仪表上",
"code": "516",
"name": ""
},
{
"region": "顶上",
"code": "616",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "716",
"name": ""
},
{
"region": "不可见区",
"code": "816",
"name": ""
},
{
"region": "左仪表区",
"code": "017",
"name": ""
},
{
"region": "中控区",
"code": "117",
"name": ""
},
{
"region": "中通道区",
"code": "217",
"name": ""
},
{
"region": "门上",
"code": "317",
"name": ""
},
{
"region": "椅上",
"code": "417",
"name": ""
},
{
"region": "仪表上",
"code": "517",
"name": ""
},
{
"region": "顶上",
"code": "617",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "717",
"name": ""
},
{
"region": "不可见区",
"code": "817",
"name": ""
},
{
"region": "左仪表区",
"code": "018",
"name": ""
},
{
"region": "中控区",
"code": "118",
"name": ""
},
{
"region": "中通道区",
"code": "218",
"name": ""
},
{
"region": "门上",
"code": "318",
"name": ""
},
{
"region": "椅上",
"code": "418",
"name": ""
},
{
"region": "仪表上",
"code": "518",
"name": ""
},
{
"region": "顶上",
"code": "618",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "718",
"name": ""
},
{
"region": "不可见区",
"code": "818",
"name": ""
}
]
},
{
"typeCode": "37",
"typeName": "线束（将电子/结构/平台字母用于区分）",
"entries": [
{
"region": "左仪表区",
"code": "000",
"name": ""
},
{
"region": "中控区",
"code": "100",
"name": ""
},
{
"region": "中通道区",
"code": "200",
"name": ""
},
{
"region": "门上",
"code": "300",
"name": ""
},
{
"region": "椅上",
"code": "400",
"name": ""
},
{
"region": "仪表上",
"code": "500",
"name": ""
},
{
"region": "顶上",
"code": "600",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "700",
"name": ""
},
{
"region": "不可见区",
"code": "800",
"name": ""
},
{
"region": "左仪表区",
"code": "001",
"name": ""
},
{
"region": "中控区",
"code": "101",
"name": ""
},
{
"region": "中通道区",
"code": "201",
"name": ""
},
{
"region": "门上",
"code": "301",
"name": ""
},
{
"region": "椅上",
"code": "401",
"name": ""
},
{
"region": "仪表上",
"code": "501",
"name": ""
},
{
"region": "顶上",
"code": "601",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "701",
"name": ""
},
{
"region": "不可见区",
"code": "801",
"name": ""
},
{
"region": "左仪表区",
"code": "002",
"name": ""
},
{
"region": "中控区",
"code": "102",
"name": ""
},
{
"region": "中通道区",
"code": "202",
"name": ""
},
{
"region": "门上",
"code": "302",
"name": ""
},
{
"region": "椅上",
"code": "402",
"name": ""
},
{
"region": "仪表上",
"code": "502",
"name": ""
},
{
"region": "顶上",
"code": "602",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "702",
"name": ""
},
{
"region": "不可见区",
"code": "802",
"name": ""
},
{
"region": "左仪表区",
"code": "003",
"name": ""
},
{
"region": "中控区",
"code": "103",
"name": ""
},
{
"region": "中通道区",
"code": "203",
"name": ""
},
{
"region": "门上",
"code": "303",
"name": ""
},
{
"region": "椅上",
"code": "403",
"name": ""
},
{
"region": "仪表上",
"code": "503",
"name": ""
},
{
"region": "顶上",
"code": "603",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "703",
"name": ""
},
{
"region": "不可见区",
"code": "803",
"name": ""
},
{
"region": "左仪表区",
"code": "004",
"name": ""
},
{
"region": "中控区",
"code": "104",
"name": ""
},
{
"region": "中通道区",
"code": "204",
"name": ""
},
{
"region": "门上",
"code": "304",
"name": ""
},
{
"region": "椅上",
"code": "404",
"name": ""
},
{
"region": "仪表上",
"code": "504",
"name": ""
},
{
"region": "顶上",
"code": "604",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "704",
"name": ""
},
{
"region": "不可见区",
"code": "804",
"name": ""
},
{
"region": "左仪表区",
"code": "005",
"name": ""
},
{
"region": "中控区",
"code": "105",
"name": ""
},
{
"region": "中通道区",
"code": "205",
"name": ""
},
{
"region": "门上",
"code": "305",
"name": ""
},
{
"region": "椅上",
"code": "405",
"name": ""
},
{
"region": "仪表上",
"code": "505",
"name": ""
},
{
"region": "顶上",
"code": "605",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "705",
"name": ""
},
{
"region": "不可见区",
"code": "805",
"name": ""
},
{
"region": "左仪表区",
"code": "006",
"name": ""
},
{
"region": "中控区",
"code": "106",
"name": ""
},
{
"region": "中通道区",
"code": "206",
"name": ""
},
{
"region": "门上",
"code": "306",
"name": ""
},
{
"region": "椅上",
"code": "406",
"name": ""
},
{
"region": "仪表上",
"code": "506",
"name": ""
},
{
"region": "顶上",
"code": "606",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "706",
"name": ""
},
{
"region": "不可见区",
"code": "806",
"name": ""
},
{
"region": "左仪表区",
"code": "007",
"name": ""
},
{
"region": "中控区",
"code": "107",
"name": ""
},
{
"region": "中通道区",
"code": "207",
"name": ""
},
{
"region": "门上",
"code": "307",
"name": ""
},
{
"region": "椅上",
"code": "407",
"name": ""
},
{
"region": "仪表上",
"code": "507",
"name": ""
},
{
"region": "顶上",
"code": "607",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "707",
"name": ""
},
{
"region": "不可见区",
"code": "807",
"name": ""
},
{
"region": "左仪表区",
"code": "008",
"name": ""
},
{
"region": "中控区",
"code": "108",
"name": ""
},
{
"region": "中通道区",
"code": "208",
"name": ""
},
{
"region": "门上",
"code": "308",
"name": ""
},
{
"region": "椅上",
"code": "408",
"name": ""
},
{
"region": "仪表上",
"code": "508",
"name": ""
},
{
"region": "顶上",
"code": "608",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "708",
"name": ""
},
{
"region": "不可见区",
"code": "808",
"name": ""
},
{
"region": "左仪表区",
"code": "009",
"name": ""
},
{
"region": "中控区",
"code": "109",
"name": ""
},
{
"region": "中通道区",
"code": "209",
"name": ""
},
{
"region": "门上",
"code": "309",
"name": ""
},
{
"region": "椅上",
"code": "409",
"name": ""
},
{
"region": "仪表上",
"code": "509",
"name": ""
},
{
"region": "顶上",
"code": "609",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "709",
"name": ""
},
{
"region": "不可见区",
"code": "809",
"name": ""
},
{
"region": "左仪表区",
"code": "010",
"name": ""
},
{
"region": "中控区",
"code": "110",
"name": ""
},
{
"region": "中通道区",
"code": "210",
"name": ""
},
{
"region": "门上",
"code": "310",
"name": ""
},
{
"region": "椅上",
"code": "410",
"name": ""
},
{
"region": "仪表上",
"code": "510",
"name": ""
},
{
"region": "顶上",
"code": "610",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "710",
"name": ""
},
{
"region": "不可见区",
"code": "810",
"name": ""
},
{
"region": "左仪表区",
"code": "011",
"name": ""
},
{
"region": "中控区",
"code": "111",
"name": ""
},
{
"region": "中通道区",
"code": "211",
"name": ""
},
{
"region": "门上",
"code": "311",
"name": ""
},
{
"region": "椅上",
"code": "411",
"name": ""
},
{
"region": "仪表上",
"code": "511",
"name": ""
},
{
"region": "顶上",
"code": "611",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "711",
"name": ""
},
{
"region": "不可见区",
"code": "811",
"name": ""
},
{
"region": "左仪表区",
"code": "012",
"name": ""
},
{
"region": "中控区",
"code": "112",
"name": ""
},
{
"region": "中通道区",
"code": "212",
"name": ""
},
{
"region": "门上",
"code": "312",
"name": ""
},
{
"region": "椅上",
"code": "412",
"name": ""
},
{
"region": "仪表上",
"code": "512",
"name": ""
},
{
"region": "顶上",
"code": "612",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "712",
"name": ""
},
{
"region": "不可见区",
"code": "812",
"name": ""
},
{
"region": "左仪表区",
"code": "013",
"name": ""
},
{
"region": "中控区",
"code": "113",
"name": ""
},
{
"region": "中通道区",
"code": "213",
"name": ""
},
{
"region": "门上",
"code": "313",
"name": ""
},
{
"region": "椅上",
"code": "413",
"name": ""
},
{
"region": "仪表上",
"code": "513",
"name": ""
},
{
"region": "顶上",
"code": "613",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "713",
"name": ""
},
{
"region": "不可见区",
"code": "813",
"name": ""
},
{
"region": "左仪表区",
"code": "014",
"name": ""
},
{
"region": "中控区",
"code": "114",
"name": ""
},
{
"region": "中通道区",
"code": "214",
"name": ""
},
{
"region": "门上",
"code": "314",
"name": ""
},
{
"region": "椅上",
"code": "414",
"name": ""
},
{
"region": "仪表上",
"code": "514",
"name": ""
},
{
"region": "顶上",
"code": "614",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "714",
"name": ""
},
{
"region": "不可见区",
"code": "814",
"name": ""
},
{
"region": "左仪表区",
"code": "015",
"name": ""
},
{
"region": "中控区",
"code": "115",
"name": ""
},
{
"region": "中通道区",
"code": "215",
"name": ""
},
{
"region": "门上",
"code": "315",
"name": ""
},
{
"region": "椅上",
"code": "415",
"name": ""
},
{
"region": "仪表上",
"code": "515",
"name": ""
},
{
"region": "顶上",
"code": "615",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "715",
"name": ""
},
{
"region": "不可见区",
"code": "815",
"name": ""
},
{
"region": "左仪表区",
"code": "016",
"name": ""
},
{
"region": "中控区",
"code": "116",
"name": ""
},
{
"region": "中通道区",
"code": "216",
"name": ""
},
{
"region": "门上",
"code": "316",
"name": ""
},
{
"region": "椅上",
"code": "416",
"name": ""
},
{
"region": "仪表上",
"code": "516",
"name": ""
},
{
"region": "顶上",
"code": "616",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "716",
"name": ""
},
{
"region": "不可见区",
"code": "816",
"name": ""
},
{
"region": "左仪表区",
"code": "017",
"name": ""
},
{
"region": "中控区",
"code": "117",
"name": ""
},
{
"region": "中通道区",
"code": "217",
"name": ""
},
{
"region": "门上",
"code": "317",
"name": ""
},
{
"region": "椅上",
"code": "417",
"name": ""
},
{
"region": "仪表上",
"code": "517",
"name": ""
},
{
"region": "顶上",
"code": "617",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "717",
"name": ""
},
{
"region": "不可见区",
"code": "817",
"name": ""
},
{
"region": "左仪表区",
"code": "018",
"name": ""
},
{
"region": "中控区",
"code": "118",
"name": ""
},
{
"region": "中通道区",
"code": "218",
"name": ""
},
{
"region": "门上",
"code": "318",
"name": ""
},
{
"region": "椅上",
"code": "418",
"name": ""
},
{
"region": "仪表上",
"code": "518",
"name": ""
},
{
"region": "顶上",
"code": "618",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "718",
"name": ""
},
{
"region": "不可见区",
"code": "818",
"name": ""
}
]
},
{
"typeCode": "65",
"typeName": "座椅按钮（纯塑料件）（将电子/结构/平台字母用于区分）",
"entries": [
{
"region": "左仪表区",
"code": "000",
"name": ""
},
{
"region": "中控区",
"code": "100",
"name": ""
},
{
"region": "中通道区",
"code": "200",
"name": ""
},
{
"region": "门上",
"code": "300",
"name": ""
},
{
"region": "椅上",
"code": "400",
"name": "左边长度调节按钮（驾驶侧）"
},
{
"region": "仪表上",
"code": "500",
"name": ""
},
{
"region": "顶上",
"code": "600",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "700",
"name": ""
},
{
"region": "不可见区",
"code": "800",
"name": ""
},
{
"region": "左仪表区",
"code": "001",
"name": ""
},
{
"region": "中控区",
"code": "101",
"name": ""
},
{
"region": "中通道区",
"code": "201",
"name": ""
},
{
"region": "门上",
"code": "301",
"name": ""
},
{
"region": "椅上",
"code": "401",
"name": "左边高度调节按钮（驾驶侧）"
},
{
"region": "仪表上",
"code": "501",
"name": ""
},
{
"region": "顶上",
"code": "601",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "701",
"name": ""
},
{
"region": "不可见区",
"code": "801",
"name": ""
},
{
"region": "左仪表区",
"code": "002",
"name": ""
},
{
"region": "中控区",
"code": "102",
"name": ""
},
{
"region": "中通道区",
"code": "202",
"name": ""
},
{
"region": "门上",
"code": "302",
"name": ""
},
{
"region": "椅上",
"code": "402",
"name": "左边调角按钮（驾驶侧）"
},
{
"region": "仪表上",
"code": "502",
"name": ""
},
{
"region": "顶上",
"code": "602",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "702",
"name": ""
},
{
"region": "不可见区",
"code": "802",
"name": ""
},
{
"region": "左仪表区",
"code": "003",
"name": ""
},
{
"region": "中控区",
"code": "103",
"name": ""
},
{
"region": "中通道区",
"code": "203",
"name": ""
},
{
"region": "门上",
"code": "303",
"name": ""
},
{
"region": "椅上",
"code": "403",
"name": ""
},
{
"region": "仪表上",
"code": "503",
"name": ""
},
{
"region": "顶上",
"code": "603",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "703",
"name": ""
},
{
"region": "不可见区",
"code": "803",
"name": ""
},
{
"region": "左仪表区",
"code": "004",
"name": ""
},
{
"region": "中控区",
"code": "104",
"name": ""
},
{
"region": "中通道区",
"code": "204",
"name": ""
},
{
"region": "门上",
"code": "304",
"name": ""
},
{
"region": "椅上",
"code": "404",
"name": "左边腿托调节按钮"
},
{
"region": "仪表上",
"code": "504",
"name": ""
},
{
"region": "顶上",
"code": "604",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "704",
"name": ""
},
{
"region": "不可见区",
"code": "804",
"name": ""
},
{
"region": "左仪表区",
"code": "005",
"name": ""
},
{
"region": "中控区",
"code": "105",
"name": ""
},
{
"region": "中通道区",
"code": "205",
"name": ""
},
{
"region": "门上",
"code": "305",
"name": ""
},
{
"region": "椅上",
"code": "405",
"name": "左边座垫调节按钮总成"
},
{
"region": "仪表上",
"code": "505",
"name": ""
},
{
"region": "顶上",
"code": "605",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "705",
"name": ""
},
{
"region": "不可见区",
"code": "805",
"name": ""
},
{
"region": "左仪表区",
"code": "006",
"name": ""
},
{
"region": "中控区",
"code": "106",
"name": ""
},
{
"region": "中通道区",
"code": "206",
"name": ""
},
{
"region": "门上",
"code": "306",
"name": ""
},
{
"region": "椅上",
"code": "406",
"name": "左边靠背调节按钮总成"
},
{
"region": "仪表上",
"code": "506",
"name": ""
},
{
"region": "顶上",
"code": "606",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "706",
"name": ""
},
{
"region": "不可见区",
"code": "806",
"name": ""
},
{
"region": "左仪表区",
"code": "007",
"name": ""
},
{
"region": "中控区",
"code": "107",
"name": ""
},
{
"region": "中通道区",
"code": "207",
"name": ""
},
{
"region": "门上",
"code": "307",
"name": ""
},
{
"region": "椅上",
"code": "407",
"name": ""
},
{
"region": "仪表上",
"code": "507",
"name": ""
},
{
"region": "顶上",
"code": "607",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "707",
"name": ""
},
{
"region": "不可见区",
"code": "807",
"name": ""
},
{
"region": "左仪表区",
"code": "008",
"name": ""
},
{
"region": "中控区",
"code": "108",
"name": ""
},
{
"region": "中通道区",
"code": "208",
"name": ""
},
{
"region": "门上",
"code": "308",
"name": ""
},
{
"region": "椅上",
"code": "408",
"name": "左前座椅后排可调节开关水平调节按钮"
},
{
"region": "仪表上",
"code": "508",
"name": ""
},
{
"region": "顶上",
"code": "608",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "708",
"name": ""
},
{
"region": "不可见区",
"code": "808",
"name": ""
},
{
"region": "左仪表区",
"code": "009",
"name": ""
},
{
"region": "中控区",
"code": "109",
"name": ""
},
{
"region": "中通道区",
"code": "209",
"name": ""
},
{
"region": "门上",
"code": "309",
"name": ""
},
{
"region": "椅上",
"code": "409",
"name": ""
},
{
"region": "仪表上",
"code": "509",
"name": ""
},
{
"region": "顶上",
"code": "609",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "709",
"name": ""
},
{
"region": "不可见区",
"code": "809",
"name": ""
},
{
"region": "左仪表区",
"code": "010",
"name": ""
},
{
"region": "中控区",
"code": "110",
"name": ""
},
{
"region": "中通道区",
"code": "210",
"name": ""
},
{
"region": "门上",
"code": "310",
"name": ""
},
{
"region": "椅上",
"code": "410",
"name": "右边座垫长度调节按钮（副驾驶侧）"
},
{
"region": "仪表上",
"code": "510",
"name": ""
},
{
"region": "顶上",
"code": "610",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "710",
"name": ""
},
{
"region": "不可见区",
"code": "810",
"name": ""
},
{
"region": "左仪表区",
"code": "011",
"name": ""
},
{
"region": "中控区",
"code": "111",
"name": ""
},
{
"region": "中通道区",
"code": "211",
"name": ""
},
{
"region": "门上",
"code": "311",
"name": ""
},
{
"region": "椅上",
"code": "411",
"name": "右边高度调节按钮（副驾驶侧）"
},
{
"region": "仪表上",
"code": "511",
"name": ""
},
{
"region": "顶上",
"code": "611",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "711",
"name": ""
},
{
"region": "不可见区",
"code": "811",
"name": ""
},
{
"region": "左仪表区",
"code": "012",
"name": ""
},
{
"region": "中控区",
"code": "112",
"name": ""
},
{
"region": "中通道区",
"code": "212",
"name": ""
},
{
"region": "门上",
"code": "312",
"name": ""
},
{
"region": "椅上",
"code": "412",
"name": "右边调角按钮（副驾驶侧）"
},
{
"region": "仪表上",
"code": "512",
"name": ""
},
{
"region": "顶上",
"code": "612",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "712",
"name": ""
},
{
"region": "不可见区",
"code": "812",
"name": ""
},
{
"region": "左仪表区",
"code": "013",
"name": ""
},
{
"region": "中控区",
"code": "113",
"name": ""
},
{
"region": "中通道区",
"code": "213",
"name": ""
},
{
"region": "门上",
"code": "313",
"name": ""
},
{
"region": "椅上",
"code": "413",
"name": "右边歇脚板调节按钮（副驾驶侧）"
},
{
"region": "仪表上",
"code": "513",
"name": ""
},
{
"region": "顶上",
"code": "613",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "713",
"name": ""
},
{
"region": "不可见区",
"code": "813",
"name": ""
},
{
"region": "左仪表区",
"code": "014",
"name": ""
},
{
"region": "中控区",
"code": "114",
"name": ""
},
{
"region": "中通道区",
"code": "214",
"name": ""
},
{
"region": "门上",
"code": "314",
"name": ""
},
{
"region": "椅上",
"code": "414",
"name": "右边腿托调节按钮（副驾驶侧）"
},
{
"region": "仪表上",
"code": "514",
"name": ""
},
{
"region": "顶上",
"code": "614",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "714",
"name": ""
},
{
"region": "不可见区",
"code": "814",
"name": ""
},
{
"region": "左仪表区",
"code": "015",
"name": ""
},
{
"region": "中控区",
"code": "115",
"name": ""
},
{
"region": "中通道区",
"code": "215",
"name": ""
},
{
"region": "门上",
"code": "315",
"name": ""
},
{
"region": "椅上",
"code": "415",
"name": "右边座椅座垫调节按钮总成"
},
{
"region": "仪表上",
"code": "515",
"name": ""
},
{
"region": "顶上",
"code": "615",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "715",
"name": ""
},
{
"region": "不可见区",
"code": "815",
"name": ""
},
{
"region": "左仪表区",
"code": "016",
"name": ""
},
{
"region": "中控区",
"code": "116",
"name": ""
},
{
"region": "中通道区",
"code": "216",
"name": ""
},
{
"region": "门上",
"code": "316",
"name": ""
},
{
"region": "椅上",
"code": "416",
"name": "右边座椅靠背调节按钮总成"
},
{
"region": "仪表上",
"code": "516",
"name": ""
},
{
"region": "顶上",
"code": "616",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "716",
"name": ""
},
{
"region": "不可见区",
"code": "816",
"name": ""
},
{
"region": "左仪表区",
"code": "017",
"name": ""
},
{
"region": "中控区",
"code": "117",
"name": ""
},
{
"region": "中通道区",
"code": "217",
"name": ""
},
{
"region": "门上",
"code": "317",
"name": ""
},
{
"region": "椅上",
"code": "417",
"name": ""
},
{
"region": "仪表上",
"code": "517",
"name": ""
},
{
"region": "顶上",
"code": "617",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "717",
"name": ""
},
{
"region": "不可见区",
"code": "817",
"name": ""
},
{
"region": "左仪表区",
"code": "018",
"name": ""
},
{
"region": "中控区",
"code": "118",
"name": ""
},
{
"region": "中通道区",
"code": "218",
"name": ""
},
{
"region": "门上",
"code": "318",
"name": ""
},
{
"region": "椅上",
"code": "418",
"name": ""
},
{
"region": "仪表上",
"code": "518",
"name": ""
},
{
"region": "顶上",
"code": "618",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "718",
"name": ""
},
{
"region": "不可见区",
"code": "818",
"name": ""
},
{
"region": "椅上",
"code": "419",
"name": "头枕调节按钮"
},
{
"region": "椅上",
"code": "420",
"name": "老板键盖板"
},
{
"region": "椅上",
"code": "421",
"name": "向后调节按钮"
}
]
},
{
"typeCode": "67",
"typeName": "摄像头支架（将电子/结构/平台字母用于区分）/开关支架/垫圈片/螺丝/螺钉",
"entries": [
{
"region": "左仪表区",
"code": "000",
"name": ""
},
{
"region": "中控区",
"code": "100",
"name": ""
},
{
"region": "中通道区",
"code": "200",
"name": ""
},
{
"region": "门上",
"code": "300",
"name": "电动后背门开关支架"
},
{
"region": "椅上",
"code": "400",
"name": ""
},
{
"region": "仪表上",
"code": "500",
"name": ""
},
{
"region": "顶上",
"code": "600",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "700",
"name": ""
},
{
"region": "不可见区",
"code": "800",
"name": "制动开关支架"
},
{
"region": "左仪表区",
"code": "001",
"name": ""
},
{
"region": "中控区",
"code": "101",
"name": ""
},
{
"region": "中通道区",
"code": "201",
"name": ""
},
{
"region": "门上",
"code": "301",
"name": ""
},
{
"region": "椅上",
"code": "401",
"name": ""
},
{
"region": "仪表上",
"code": "501",
"name": ""
},
{
"region": "顶上",
"code": "601",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "701",
"name": ""
},
{
"region": "不可见区",
"code": "801",
"name": "垫圈片"
},
{
"region": "左仪表区",
"code": "002",
"name": ""
},
{
"region": "中控区",
"code": "102",
"name": ""
},
{
"region": "中通道区",
"code": "202",
"name": ""
},
{
"region": "门上",
"code": "302",
"name": ""
},
{
"region": "椅上",
"code": "402",
"name": ""
},
{
"region": "仪表上",
"code": "502",
"name": ""
},
{
"region": "顶上",
"code": "602",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "702",
"name": ""
},
{
"region": "不可见区",
"code": "802",
"name": "螺丝/螺钉"
},
{
"region": "左仪表区",
"code": "003",
"name": ""
},
{
"region": "中控区",
"code": "103",
"name": ""
},
{
"region": "中通道区",
"code": "203",
"name": ""
},
{
"region": "门上",
"code": "303",
"name": ""
},
{
"region": "椅上",
"code": "403",
"name": ""
},
{
"region": "仪表上",
"code": "503",
"name": ""
},
{
"region": "顶上",
"code": "603",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "703",
"name": ""
},
{
"region": "不可见区",
"code": "803",
"name": ""
},
{
"region": "左仪表区",
"code": "004",
"name": ""
},
{
"region": "中控区",
"code": "104",
"name": ""
},
{
"region": "中通道区",
"code": "204",
"name": ""
},
{
"region": "门上",
"code": "304",
"name": ""
},
{
"region": "椅上",
"code": "404",
"name": ""
},
{
"region": "仪表上",
"code": "504",
"name": ""
},
{
"region": "顶上",
"code": "604",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "704",
"name": ""
},
{
"region": "不可见区",
"code": "804",
"name": ""
},
{
"region": "左仪表区",
"code": "005",
"name": ""
},
{
"region": "中控区",
"code": "105",
"name": ""
},
{
"region": "中通道区",
"code": "205",
"name": ""
},
{
"region": "门上",
"code": "305",
"name": ""
},
{
"region": "椅上",
"code": "405",
"name": ""
},
{
"region": "仪表上",
"code": "505",
"name": ""
},
{
"region": "顶上",
"code": "605",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "705",
"name": ""
},
{
"region": "不可见区",
"code": "805",
"name": ""
},
{
"region": "左仪表区",
"code": "006",
"name": ""
},
{
"region": "中控区",
"code": "106",
"name": ""
},
{
"region": "中通道区",
"code": "206",
"name": ""
},
{
"region": "门上",
"code": "306",
"name": ""
},
{
"region": "椅上",
"code": "406",
"name": ""
},
{
"region": "仪表上",
"code": "506",
"name": ""
},
{
"region": "顶上",
"code": "606",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "706",
"name": ""
},
{
"region": "不可见区",
"code": "806",
"name": ""
},
{
"region": "左仪表区",
"code": "007",
"name": ""
},
{
"region": "中控区",
"code": "107",
"name": ""
},
{
"region": "中通道区",
"code": "207",
"name": ""
},
{
"region": "门上",
"code": "307",
"name": ""
},
{
"region": "椅上",
"code": "407",
"name": ""
},
{
"region": "仪表上",
"code": "507",
"name": ""
},
{
"region": "顶上",
"code": "607",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "707",
"name": ""
},
{
"region": "不可见区",
"code": "807",
"name": ""
},
{
"region": "左仪表区",
"code": "008",
"name": ""
},
{
"region": "中控区",
"code": "108",
"name": ""
},
{
"region": "中通道区",
"code": "208",
"name": ""
},
{
"region": "门上",
"code": "308",
"name": ""
},
{
"region": "椅上",
"code": "408",
"name": ""
},
{
"region": "仪表上",
"code": "508",
"name": ""
},
{
"region": "顶上",
"code": "608",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "708",
"name": ""
},
{
"region": "不可见区",
"code": "808",
"name": ""
},
{
"region": "左仪表区",
"code": "009",
"name": ""
},
{
"region": "中控区",
"code": "109",
"name": ""
},
{
"region": "中通道区",
"code": "209",
"name": ""
},
{
"region": "门上",
"code": "309",
"name": ""
},
{
"region": "椅上",
"code": "409",
"name": ""
},
{
"region": "仪表上",
"code": "509",
"name": ""
},
{
"region": "顶上",
"code": "609",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "709",
"name": ""
},
{
"region": "不可见区",
"code": "809",
"name": ""
},
{
"region": "左仪表区",
"code": "010",
"name": ""
},
{
"region": "中控区",
"code": "110",
"name": ""
},
{
"region": "中通道区",
"code": "210",
"name": ""
},
{
"region": "门上",
"code": "310",
"name": ""
},
{
"region": "椅上",
"code": "410",
"name": ""
},
{
"region": "仪表上",
"code": "510",
"name": ""
},
{
"region": "顶上",
"code": "610",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "710",
"name": ""
},
{
"region": "不可见区",
"code": "810",
"name": ""
},
{
"region": "左仪表区",
"code": "011",
"name": ""
},
{
"region": "中控区",
"code": "111",
"name": ""
},
{
"region": "中通道区",
"code": "211",
"name": ""
},
{
"region": "门上",
"code": "311",
"name": ""
},
{
"region": "椅上",
"code": "411",
"name": ""
},
{
"region": "仪表上",
"code": "511",
"name": ""
},
{
"region": "顶上",
"code": "611",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "711",
"name": ""
},
{
"region": "不可见区",
"code": "811",
"name": ""
},
{
"region": "左仪表区",
"code": "012",
"name": ""
},
{
"region": "中控区",
"code": "112",
"name": ""
},
{
"region": "中通道区",
"code": "212",
"name": ""
},
{
"region": "门上",
"code": "312",
"name": ""
},
{
"region": "椅上",
"code": "412",
"name": ""
},
{
"region": "仪表上",
"code": "512",
"name": ""
},
{
"region": "顶上",
"code": "612",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "712",
"name": ""
},
{
"region": "不可见区",
"code": "812",
"name": ""
},
{
"region": "左仪表区",
"code": "013",
"name": ""
},
{
"region": "中控区",
"code": "113",
"name": ""
},
{
"region": "中通道区",
"code": "213",
"name": ""
},
{
"region": "门上",
"code": "313",
"name": ""
},
{
"region": "椅上",
"code": "413",
"name": ""
},
{
"region": "仪表上",
"code": "513",
"name": ""
},
{
"region": "顶上",
"code": "613",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "713",
"name": ""
},
{
"region": "不可见区",
"code": "813",
"name": ""
},
{
"region": "左仪表区",
"code": "014",
"name": ""
},
{
"region": "中控区",
"code": "114",
"name": ""
},
{
"region": "中通道区",
"code": "214",
"name": ""
},
{
"region": "门上",
"code": "314",
"name": ""
},
{
"region": "椅上",
"code": "414",
"name": ""
},
{
"region": "仪表上",
"code": "514",
"name": ""
},
{
"region": "顶上",
"code": "614",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "714",
"name": ""
},
{
"region": "不可见区",
"code": "814",
"name": ""
},
{
"region": "左仪表区",
"code": "015",
"name": ""
},
{
"region": "中控区",
"code": "115",
"name": ""
},
{
"region": "中通道区",
"code": "215",
"name": ""
},
{
"region": "门上",
"code": "315",
"name": ""
},
{
"region": "椅上",
"code": "415",
"name": ""
},
{
"region": "仪表上",
"code": "515",
"name": ""
},
{
"region": "顶上",
"code": "615",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "715",
"name": ""
},
{
"region": "不可见区",
"code": "815",
"name": ""
},
{
"region": "左仪表区",
"code": "016",
"name": ""
},
{
"region": "中控区",
"code": "116",
"name": ""
},
{
"region": "中通道区",
"code": "216",
"name": ""
},
{
"region": "门上",
"code": "316",
"name": ""
},
{
"region": "椅上",
"code": "416",
"name": ""
},
{
"region": "仪表上",
"code": "516",
"name": ""
},
{
"region": "顶上",
"code": "616",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "716",
"name": ""
},
{
"region": "不可见区",
"code": "816",
"name": ""
},
{
"region": "左仪表区",
"code": "017",
"name": ""
},
{
"region": "中控区",
"code": "117",
"name": ""
},
{
"region": "中通道区",
"code": "217",
"name": ""
},
{
"region": "门上",
"code": "317",
"name": ""
},
{
"region": "椅上",
"code": "417",
"name": ""
},
{
"region": "仪表上",
"code": "517",
"name": ""
},
{
"region": "顶上",
"code": "617",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "717",
"name": ""
},
{
"region": "不可见区",
"code": "817",
"name": ""
},
{
"region": "左仪表区",
"code": "018",
"name": ""
},
{
"region": "中控区",
"code": "118",
"name": ""
},
{
"region": "中通道区",
"code": "218",
"name": ""
},
{
"region": "门上",
"code": "318",
"name": ""
},
{
"region": "椅上",
"code": "418",
"name": ""
},
{
"region": "仪表上",
"code": "518",
"name": ""
},
{
"region": "顶上",
"code": "618",
"name": ""
},
{
"region": "方向柱及方向盘上",
"code": "718",
"name": ""
},
{
"region": "不可见区",
"code": "818",
"name": ""
},
{
"region": "椅上",
"code": "419",
"name": ""
},
{
"region": "椅上",
"code": "420",
"name": ""
}
]
}
]

/** 高新项目列表（附表6，77 条，忠实原文） */
export const HITECH_PROJECTS: HitechProject[] = [
{
"no": "RD2001",
"name": "怀档式ETRS技术的研究"
},
{
"no": "RD2002",
"name": "触摸接近感应大灯的研究"
},
{
"no": "RD2003",
"name": "吉利GEEA2.0 自动空调平台控制器"
},
{
"no": "RD2004",
"name": "车载多功能触控空调屏"
},
{
"no": "RD2005",
"name": "车载大屏带震动反馈"
},
{
"no": "RD2006",
"name": "双层SENSO式压感震动面板的研究"
},
{
"no": "RD2007",
"name": "物理压力防误操作触摸安全件开关面板的研究"
},
{
"no": "RD2008",
"name": "热管理自动标定系统的研究"
},
{
"no": "RD2009",
"name": "车载多联屏LENS防开胶技术研究"
},
{
"no": "RD2010",
"name": "方向盘单滚轮开关研发"
},
{
"no": "RD2011",
"name": "空调面板的大尺寸、高拉伸膜片技术研究"
},
{
"no": "RD2012",
"name": "方向盘开关的手势滑动压力加震动反馈技术研究"
},
{
"no": "RD2013",
"name": "耐刮擦触摸方向盘开关研发"
},
{
"no": "RD2014",
"name": "指纹识别一键启动开关技术研究"
},
{
"no": "RD2015",
"name": "仪表&中控双联屏的异形表面技术研究"
},
{
"no": "RD2016",
"name": "方向盘开关的光电模块触摸技术研究"
},
{
"no": "RD2017",
"name": "新能源汽车电子换挡技术研发"
},
{
"no": "RD2018",
"name": "大灯触摸开关的五色注塑模具技术研究"
},
{
"no": "RD2019",
"name": "基于Moldflow的汽车零件注塑工艺优化及模具设计"
},
{
"no": "RD2020",
"name": "电容式感应智能大灯开关"
},
{
"no": "RD2101",
"name": "双色导电橡胶触摸技术研究"
},
{
"no": "RD2102",
"name": "后视镜开关散发均匀光路设计优化研究"
},
{
"no": "RD2103",
"name": "水晶效果开关的技术研究"
},
{
"no": "RD2104",
"name": "一种低摩擦的新型旋钮研究"
},
{
"no": "RD2105",
"name": "双层旋钮指示光路设计研究"
},
{
"no": "RD2106",
"name": "多功能自动升降旋钮开关"
},
{
"no": "RD2107",
"name": "电动吸顶屏设计研究"
},
{
"no": "RD2108",
"name": "长寿命膜片表面的前空调面板设计研究"
},
{
"no": "RD2109",
"name": "电子油泵控制器研究"
},
{
"no": "RD2110",
"name": "电动车热系统集成控制技术研究"
},
{
"no": "RD2111",
"name": "电动窗自动化测试负载箱设计研究"
},
{
"no": "RD2112",
"name": "面板光强自动测试台设计研究"
},
{
"no": "RD2113",
"name": "新能源车数据转发模块技术研究"
},
{
"no": "RD2114",
"name": "双12.3联屏模块总成设计研究"
},
{
"no": "RD2115",
"name": "霍尔开关技术研究"
},
{
"no": "RD2116",
"name": "基于注塑成型技术的抽真空工艺及设备研发"
},
{
"no": "RD2117",
"name": "基于3D打印的随形冷却水道注塑模具研发"
},
{
"no": "RD2118",
"name": "模具涂层工艺在双色倒装模上的应用研究"
},
{
"no": "RD2119",
"name": "电镀免镭雕双色模设计研发"
},
{
"no": "RD2120",
"name": "汽车触摸开关的三色/混色模具研发"
},
{
"no": "RD2122",
"name": "空调控制面板旋钮模具工艺研究"
},
{
"no": "RD2123",
"name": "自动泊车技术研究"
},
{
"no": "RD2108",
"name": "长寿命膜片表面的前空调面板设计研究"
},
{
"no": "RD2202",
"name": "汽车冷热杯托产品的研究"
},
{
"no": "RD2208",
"name": "车载多联显示屏白平衡研究"
},
{
"no": "RD2209",
"name": "车载多功能扶手屏研究"
},
{
"no": "RD2214",
"name": "汽车制动灯开关低压注塑技术应用研究"
},
{
"no": "RD2215",
"name": "集成怀档功能的组合开关与时钟弹簧总成研究"
},
{
"no": "RD2216",
"name": "新型空调面板多色氛围灯技术研究"
},
{
"no": "RD2221",
"name": "NC高速镜面加工工艺研究"
},
{
"no": "RD2222",
"name": "厚壁光学透明件技术工艺改善研究"
},
{
"no": "RD2223",
"name": "模内热切技术工艺改善研究"
},
{
"no": "RD2224",
"name": "细皮纹免喷涂技术工艺改善研究"
},
{
"no": "RD2225",
"name": "激光雕刻加工皮纹模具技术的应用研究"
},
{
"no": "RD2228",
"name": "TFT模组烧录装置研究"
},
{
"no": "RD2212",
"name": "多功能旋钮技术研究"
},
{
"no": "RD2109",
"name": "电子油泵控制器研究"
},
{
"no": "RD2110",
"name": "电动车热系统集成控制技术研究"
},
{
"no": "RD2124",
"name": "自动泊车系统技术研究"
},
{
"no": "RD2203",
"name": "UWB厘米级定位技术及汽车数字钥匙的研究"
},
{
"no": "RD2205",
"name": "新整车架构下的区域控制器的研究"
},
{
"no": "RD2207",
"name": "虚拟车内温度算法研究"
},
{
"no": "RD2210",
"name": "77GHz车载毫米波雷达研究"
},
{
"no": "RD2217",
"name": "一体式触摸方向盘开关研究"
},
{
"no": "RD2218",
"name": "新型触摸式电动窗开关技术应用研究"
},
{
"no": "RD2226",
"name": "双联屏贴合生产线的研发"
},
{
"no": "RD2227",
"name": "大屏环形回流线研发"
},
{
"no": "RD2230",
"name": "窄边框超薄悬浮三联屏产品研究"
},
{
"no": "RD2231",
"name": "车载OLED中控屏产品研究"
},
{
"no": "RD2232",
"name": "车用消杀灯的技术研发"
},
{
"no": "RD2233",
"name": "多色彩光路氛围灯技术的研究"
},
{
"no": "RD2234",
"name": "水晶手球集成显示屏技术研究"
},
{
"no": "RD2235",
"name": "集成角度传感器及怀挡功能的组合开关"
},
{
"no": "RD2236",
"name": "CAN总线面板类柔性自动化测试设备研究与应用"
},
{
"no": "RD2237",
"name": "LENS贴合减少除泡工艺的触摸按键结构研究与应用"
},
{
"no": "RD2238",
"name": "汽车组合开关模具精密加工工艺研究"
},
{
"no": "RD2239",
"name": "导光体嵌入式多色模具的设计研发及其应用"
}
]

/** 机动总成编码汇总表（附表7，61 条，忠实原文） */
export const AGG_CODES: AggCode[] = [
{
"no": "1",
"code": "0U1F27EA0001",
"name": "EPB开关-极胄黑",
"date": "20230302",
"note": "0U1F27EACAWA"
},
{
"no": "2",
"code": "0K2A71GA0001",
"name": "五档开关分总成",
"date": "20230303",
"note": "0K2A71GANLWA"
},
{
"no": "3",
"code": "0K2A71GA0001",
"name": "四档开关分总成",
"date": "20230303",
"note": "0K2A71GANLWA"
},
{
"no": "4",
"code": "0U1L47BC0001",
"name": "换挡操纵机构面板总成-沙丘棕",
"date": "20230315",
"note": "0U1L47BCCAWA"
},
{
"no": "5",
"code": "0U1L47BD0001",
"name": "换挡操纵机构面板总成-佩尔格米",
"date": "20230315",
"note": "0U1L47BDCAWA"
},
{
"no": "6",
"code": "0U1L47BE0001",
"name": "换挡操纵机构面板总成-佩特拉棕",
"date": "20230315",
"note": "0U1L47BECAWA"
},
{
"no": "7",
"code": "0K2A71GA0001",
"name": "左后电动门窗开关总成",
"date": "20230315",
"note": "0K2A71GANLWA"
},
{
"no": "8",
"code": "0K2A71DA0001",
"name": "左后电动门窗开关总成",
"date": "20230315",
"note": "0K2A71DANLWA"
},
{
"no": "9",
"code": "0U1F27EA0001",
"name": "换挡操纵机构面板总成-极胄黑",
"date": "20230315",
"note": "0U1F27EACAWA"
},
{
"no": "10",
"code": "AH0C07AA0001",
"name": "主驾驶玻璃升降开关总成（白色）",
"date": "20230317",
"note": "AH0C07AABAWA"
},
{
"no": "11",
"code": "AH0C71CA0001",
"name": "副驾驶玻璃升降开关总成（白色）",
"date": "20230317",
"note": "AH0C71CA4LWA"
},
{
"no": "12",
"code": "AU0D02AA0001",
"name": "空调控制模块",
"date": "20230509",
"note": "AU0D02AACWWA"
},
{
"no": "13",
"code": "AU0D02BA0001",
"name": "空调控制模块",
"date": "20230509",
"note": "AU0D02BACWWA"
},
{
"no": "14",
"code": "0U1K95GA0002",
"name": "按钮-钛晶灰",
"date": "20230517",
"note": "0U1K95GA4SWA"
},
{
"no": "15",
"code": "0U1K95KA0001",
"name": "按钮-哑光极地铜",
"date": "20230518",
"note": "0U1K95KA4YWA"
},
{
"no": "16",
"code": "0U1K95LA0001",
"name": "按钮-哑光极地银",
"date": "20230518",
"note": "0U1K95LA4YWA"
},
{
"no": "17",
"code": "0L2E23AA0001",
"name": "吸顶屏",
"date": "20230821",
"note": "0L2E23AASWWA"
},
{
"no": "18",
"code": "0L2E23AA0002",
"name": "吸顶屏",
"date": "20230821",
"note": "0L2E23AASWWA"
},
{
"no": "19",
"code": "0L2E23AA0003",
"name": "吸顶屏",
"date": "20230821",
"note": "0L2E23AASWWA"
},
{
"no": "20",
"code": "0L2E23AA0004",
"name": "吸顶屏",
"date": "20230821",
"note": "0L2E23AASWWA"
},
{
"no": "21",
"code": "AD1E10AA0001",
"name": "智能区域控制模块",
"date": "20230821",
"note": "AD1E10AATWWA"
},
{
"no": "22",
"code": "AD1E10AA0002",
"name": "智能区域控制模块",
"date": "20230821",
"note": "AD1E10AATWWA"
},
{
"no": "23",
"code": "AD1E10AA0003",
"name": "智能区域控制模块",
"date": "20230821",
"note": "AD1E10AATWWA"
},
{
"no": "24",
"code": "AD1E10AA0004",
"name": "智能区域控制模块",
"date": "20230821",
"note": "AD1E10AATWWA"
},
{
"no": "25",
"code": "AD1E10BA0001",
"name": "智能区域控制模块",
"date": "20230821",
"note": "AD1E10BATWWA"
},
{
"no": "26",
"code": "AD1E10BA0002",
"name": "智能区域控制模块",
"date": "20230821",
"note": "AD1E10BATWWA"
},
{
"no": "27",
"code": "AD1E10BA0003",
"name": "智能区域控制模块",
"date": "20230821",
"note": "AD1E10BATWWA"
},
{
"no": "28",
"code": "AD1E10BA0004",
"name": "智能区域控制模块",
"date": "20230821",
"note": "AD1E10BATWWA"
},
{
"no": "29",
"code": "0M2C07EA0001",
"name": "主驾门窗开关低配-子开关",
"date": "20230905",
"note": "0M2C07EALAWA"
},
{
"no": "30",
"code": "0M2C07FA0001",
"name": "主驾门窗开关中配-子开关",
"date": "20230905",
"note": "0M2C07FALAWA"
},
{
"no": "31",
"code": "0M1K72DA0001",
"name": "主驾驶电动窗开关-子开关",
"date": "20230905",
"note": "0M1K72DALAWA"
},
{
"no": "32",
"code": "0M2L72EA0001",
"name": "主驾门窗开关（高配）-子开关",
"date": "20230905",
"note": "0M2L72EALAWA"
},
{
"no": "33",
"code": "0M2L72FA0001",
"name": "主驾门窗开关（次高配）-子开关",
"date": "20230905",
"note": "0M2L72FALAWA"
},
{
"no": "34",
"code": "0M2L72GA0001",
"name": "主驾门窗开关（中配）-子开关",
"date": "20230905",
"note": "0M2L72GALAWA"
},
{
"no": "35",
"code": "0M2L72HA0001",
"name": "主驾门窗开关（低配）-子开关",
"date": "20230905",
"note": "0M2L72HALAWA"
},
{
"no": "36",
"code": "0M1T72CA0001",
"name": "驾驶员门窗开关总成-子开关",
"date": "20230905",
"note": "0M1T72CALAWA"
},
{
"no": "37",
"code": "0M1T72DA0001",
"name": "主驾门窗开关（低配）-子开关",
"date": "20230905",
"note": "0M1T72DALAWA"
},
{
"no": "38",
"code": "0M1T72EA0001",
"name": "主驾门窗开关（中配）-子开关",
"date": "20230905",
"note": "0M1T72EALAWA"
},
{
"no": "39",
"code": "0M1T72FA0001",
"name": "主驾门窗开关（高配）-子开关",
"date": "20230905",
"note": "0M1T72FALAWA"
},
{
"no": "40",
"code": "0M1T72GA0001",
"name": "主驾门窗开关（中配）-子开关",
"date": "20230905",
"note": "0M1T72GALAWA"
},
{
"no": "41",
"code": "0M1D07AA0001",
"name": "主驾驶电动窗开关-子开关",
"date": "20230906",
"note": "0M1D07AALAWA"
},
{
"no": "42",
"code": "0M1D07BA0001",
"name": "主驾驶电动窗开关-子开关",
"date": "20230906",
"note": "0M1D07BALAWA"
},
{
"no": "43",
"code": "0M1D07CA0001",
"name": "主驾驶电动窗开关-子开关",
"date": "20230906",
"note": "0M1D07CALAWA"
},
{
"no": "44",
"code": "0M2G07AA0001",
"name": "主驾驶电动窗开关-子开关",
"date": "20230906",
"note": "0M2G07AALAWA"
},
{
"no": "45",
"code": "0M2G07BA0001",
"name": "主驾驶电动窗开关-子开关",
"date": "20230906",
"note": "0M2G07BALAWA"
},
{
"no": "46",
"code": "0M2G07CA0001",
"name": "主驾驶电动窗开关-子开关",
"date": "20230906",
"note": "0M2G07CALAWA"
},
{
"no": "47",
"code": "0M2G07DA0001",
"name": "主驾驶电动窗开关-子开关",
"date": "20230906",
"note": "0M2G07DALAWA"
},
{
"no": "48",
"code": "0M2G07EA0001",
"name": "主驾驶电动窗开关-子开关",
"date": "20230906",
"note": "0M2G07EALAWA"
},
{
"no": "49",
"code": "0M2G07FA0001",
"name": "主驾驶电动窗开关-子开关",
"date": "20230906",
"note": "0M2G07FALAWA"
},
{
"no": "序号",
"code": "保供总成编码",
"name": "子总成名称",
"date": "登记日期",
"note": "说明(保供技术方案特点)"
},
{
"no": "1",
"code": "0F1R98KA2001",
"name": "方向盘开关总成",
"date": "20230315",
"note": "F1RZ98C"
},
{
"no": "2",
"code": "0F1R98CA2001",
"name": "方向盘开关总成",
"date": "20230315",
"note": "0F1R98CALAWA"
},
{
"no": "3",
"code": "0F1X98AA2001",
"name": "方向盘开关总成",
"date": "20230315",
"note": "0F1X98AALAWA"
},
{
"no": "4",
"code": "BQ1A52CA2001",
"name": "组合开关与时钟弹簧总成",
"date": "20230315",
"note": "BQ1A52CACAWA"
},
{
"no": "5",
"code": "AU0D02AA2001",
"name": "空调控制模块",
"date": "20230510",
"note": "AU0D02AACWWA"
},
{
"no": "6",
"code": "AU0D02BA2001",
"name": "空调控制模块",
"date": "20230510",
"note": "AU0D02BACWWA"
},
{
"no": "7",
"code": "0K1L04AA2001",
"name": "空调控制面板总成-北汽股份",
"date": "20230628",
"note": ""
},
{
"no": "8",
"code": "0K2G04AA2001",
"name": "空调控制面板总成-北汽股份",
"date": "20230628",
"note": ""
},
{
"no": "9",
"code": "0K2R04AA2001",
"name": "空调控制面板总成-北汽股份",
"date": "20230628",
"note": ""
},
{
"no": "序号",
"code": "工程变更后总成编码",
"name": "总成名称",
"date": "登记日期",
"note": "说明(保供技术方案特点)"
},
{
"no": "1",
"code": "0F1R98KA3001",
"name": "方向盘开关总成",
"date": "20230315",
"note": "F1RZ98C"
}
]
