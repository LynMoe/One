(() => {
    "use strict";
    let validURL = (str) => {
        var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
            '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
            '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
            '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
        return !!pattern.test(str);
    };

    let replaceURL = (url) => {
        let map = {
            'https://xiaolin.in': '/blog',
            'https://cdnjs.cloudflare.com': '/cdnjs',
            'https://secure.gravatar.com': '/avatar',
            'https://fonts.googleapis.com': '/googlefont',
            'https://storage.xiaolin.in': '/storage',
            'https://s.w.org': '/sworg',
            'https://static.xiaolin.in/gravatar': '/avatar',
            'https://api.byi.pw': '/sitesicon',
            'https://i.loli.net': '/iloli',
        };
        
        for (let i in map)
        {
            if (url.indexOf(i) !== -1)
                return url.replace(i, `https://getxiaol.in${map[i]}`)
        }

        return url;
    };

    let scripts = document.getElementsByTagName('script');
    let styles = document.getElementsByTagName('link');
    let images = document.getElementsByTagName('img');

    for (let item = 0;item < scripts.length;item++) {
        if (!scripts[item] || !validURL(scripts[item]['src']))
            continue;
        scripts[item]['src'] = replaceURL(scripts[item]['src']);
    }

    for (let item = 0;item < styles.length;item++) {
        if (!styles[item] || !validURL(styles[item]['href']))
            continue;
        if (styles[item]['rel'] === 'stylesheet') {
            styles[item]['href'] = replaceURL(styles[item]['href']);
        }
    }

    for (let item = 0;item < images.length;item++) {
        if (!images[item] || !validURL(images[item]['src']))
            continue;
        images[item]['src'] = replaceURL(images[item]['src']);
    }
})();