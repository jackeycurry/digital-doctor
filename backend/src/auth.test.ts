import { register, login } from './auth.js'

const testPhone = '13800138000'
const testPassword = 'TestPass123'

const reg = await register(testPhone, testPassword)
console.assert(reg.success === true, '注册应成功')

const reg2 = await register(testPhone, testPassword)
console.assert(reg2.success === false, '重复注册应失败')

const log = await login(testPhone, testPassword)
console.assert(log.success === true, '登录应成功')
console.assert('token' in log, '应返回 token')

const log2 = await login(testPhone, 'wrong')
console.assert(log2.success === false, '密码错误应失败')

const log3 = await login('13900000000', testPassword)
console.assert(log3.success === false, '用户不存在应失败')

console.log('auth tests passed')