import { TokenProvider } from './token'
import { Backend } from './backend'

const PROXY_HEADER_ALLOW_LIST: string[] = ["accept", "user-agent", "accept-encoding"]

const ORG_NAME_BACKEND:{ [key: string]: string; } = {
  "docker": "https://registry-1.docker.io",
  "gcr": "https://gcr.io",
  "k8sgcr": "https://k8s.gcr.io",
  "quay": "https://quay.io",
  "nodesource": "https://deb.nodesource.com",
  "npmjs": "https://registry.npmjs.org",
}

const DEFAULT_BACKEND_ORG: string = "docker"

export async function handleRequest(request: Request): Promise<Response> {
  return handleRegistryRequest(request)
}

function copyProxyHeaders(inputHeaders: Headers) : Headers {
  const headers = new Headers;
  for(const pair of inputHeaders.entries()) {
    if (pair[0].toLowerCase() in PROXY_HEADER_ALLOW_LIST) {
      headers.append(pair[0], pair[1])
    }
  }
  return headers
}

function orgNameFromPath(pathname: string): string|null {
  const splitedPath: string[] = pathname.split("/", 2)
  if (splitedPath.length === 2 && splitedPath[0] === "") {
    return splitedPath[1].toLowerCase()
  }
  return DEFAULT_BACKEND_ORG
}

function orgNameFromHost(host: string): string|null {
  const splitedHost: string[] = host.split(".", 2)
  if (splitedHost.length === 2 && splitedHost[1] === "mirrors") {
    return splitedHost[0].toLowerCase()
  }
  return DEFAULT_BACKEND_ORG
}

function hostByOrgName(orgName: string|null): string {
  if (orgName !== null && orgName in ORG_NAME_BACKEND) {
    return ORG_NAME_BACKEND[orgName]
  }
  return ORG_NAME_BACKEND[DEFAULT_BACKEND_ORG]
}

function rewritePathByOrg(orgName: string|null, pathname: string): string {
  // if (orgName === null || !(orgName in ORG_NAME_BACKEND)) {
  //   console.log(`${pathname}`);
  //   return pathname
  // }
  const splitedPath: string[] = pathname.split("/")
  const cleanSplitedPath = splitedPath.filter(function(value: string, index: number) {
    return value !== orgName;
  })
  console.log(`${cleanSplitedPath.join("/")}`);
  return cleanSplitedPath.join("/")
}

async function handleRegistryRequest(request: Request): Promise<Response> {
  const reqURL = new URL(request.url)
  const orgName = orgNameFromHost(reqURL.host)
  const pathname = rewritePathByOrg(orgName, reqURL.pathname)
  const host = hostByOrgName(orgName)
  const tokenProvider = new TokenProvider()
  const backend = new Backend(host, tokenProvider)
  const headers = copyProxyHeaders(request.headers)

  console.log(`reqURL: ${reqURL}`);
  console.log(`orgName: ${orgName}`);
  console.log(`pathname: ${pathname}`);
  console.log(`host: ${host}`);
  return backend.proxy(pathname, {headers: request.headers})
}
