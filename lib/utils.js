function isEmpty(obj) {
    if (obj == null) return true;
    if (obj.length > 0) return false;
    if (obj.length === 0) return true;
    if (typeof obj !== "object") return true;
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }
    return true;
}

function parseLinkHeader(link) {
    if (!link) {
        return {}
    }
    var linkexp = /<[^>]*>\s*(\s*;\s*[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*")))*(,|$)/g
    var paramexp = /[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*"))/g
    var matches = link.match(linkexp)
    var rels = {}
    for (var i = 0; i < matches.length; i++) {
        var split = matches[i].split('>')
        var href = split[0].substring(1)
        var ps = split[1]
        var s = ps.match(paramexp)

        for (var j = 0; j < s.length; j++) {
            var p = s[j]
            var paramsplit = p.split('=')
            // var name = paramsplit[0]
            var rel = paramsplit[1].replace(/["']/g, '')
            if (!rels[rel]) {
                rels[rel] = []
            }
            rels[rel].push(href)
            if (rels[rel].length > 1) {
                rels[rel].sort()
            }
        }
    }
    return rels
}

function hostname(url) {
    var protocol, hostname, result, pathSegments
    var fragments = url.split('//')
    if (fragments.length === 2) {
        protocol = fragments[0]
        hostname = fragments[1]
    } else {
        hostname = url
    }
    pathSegments = hostname.split('/')
    if (protocol) {
        result = protocol + '//' + pathSegments[0]
    } else {
        result = pathSegments[0]
    }
    if (url.startsWith('//')) {
        result = '//' + result
    }
    return result
}

/**
 * Return an absolute URL
 * @method absoluteUrl
 * @param baseUrl {String} URL to be used as base
 * @param pathUrl {String} Absolute or relative URL
 * @return {String}
 */
function absoluteUrl(baseUrl, pathUrl) {
    if (pathUrl && pathUrl.slice(0, 4) !== 'http') {
        return [baseUrl, pathUrl].map(function (path) {
            if (path[0] === '/') {
                path = path.slice(1)
            }
            if (path[path.length - 1] === '/') {
                path = path.slice(0, path.length - 1)
            }
            return path
        }).join('/')
    }
    return pathUrl
}

module.exports.isEmpty = isEmpty;
module.exports.parseLinkHeader = parseLinkHeader;
module.exports.absoluteUrl = absoluteUrl;
module.exports.hostname = hostname;