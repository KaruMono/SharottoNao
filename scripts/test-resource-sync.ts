const endpoint = process.env.PUBLISH_ENDPOINT || 'http://localhost:3000/api/resources/sync'
const token = process.env.PUBLISH_TOKEN || ''
const vndbId = process.env.PUBLISH_TEST_VNDB_ID || ''
const typeId = Number(process.env.PUBLISH_TEST_TYPE_ID || 1)

if (!token) {
  console.error('缺少 PUBLISH_TOKEN，例如：PUBLISH_TOKEN=your-token pnpm exec tsx scripts/test-resource-sync.ts')
  process.exit(1)
}

if (!/^v\d+$/i.test(vndbId)) {
  console.error('缺少 PUBLISH_TEST_VNDB_ID，例如：PUBLISH_TEST_VNDB_ID=v12345')
  process.exit(1)
}

const payload = {
  vndbId,
  title: '[Windows]ディメンション凸ラバース!! 7Z',
  url: 'https://example.com/download/CRYSTALiA/dimension-ravers',
  extractCode: 'abcd',
  unzipPassword: 'example-password',
  fileSize: '8G',
  typeId,
  remark: '自动发布测试资源',
  language: 'zh-Hans',
  isMachineTranslated: false,
}

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
})

const text = await response.text()
let data: unknown
try {
  data = JSON.parse(text)
} catch {
  data = text
}

console.log(JSON.stringify({
  endpoint,
  status: response.status,
  ok: response.ok,
  data,
}, null, 2))

if (!response.ok) {
  process.exit(1)
}