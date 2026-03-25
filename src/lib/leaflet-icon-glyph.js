// Source - https://github.com/Leaflet/Leaflet.Icon.Glyph


L.Icon.Glyph = L.Icon.extend({
    options: {
        iconSize: [70, 70],
        iconAnchor:  [35, 68],
        popupAnchor: [1, -70],
        shadowSize:  [71, 71],
// 		iconUrl: 'glyph-marker-icon.png',
// 		iconSize: [35, 45],
// 		iconAnchor:   [17, 42],
// 		popupAnchor: [1, -32],
// 		shadowAnchor: [10, 12],
// 		shadowSize: [36, 16],
// 		bgPos: (Point)
        className: '',
        prefix: '',
        glyph: 'home',
        glyphColor: 'white',
        glyphSize: '11px',	// in CSS units
        glyphAnchor: [0, -18]	// In pixels, counting from the center of the image.
    },

    _getIconUrl: function (name) {
        if (name === 'icon') {
            const color = this.options.markerColor || "#3388ff";

            const svg = `
<svg xmlns="http://www.w3.org/2000/svg" fill="${color}" class="bi bi-geo-fill" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M4 4a4 4 0 1 1 4.5 3.969V13.5a.5.5 0 0 1-1 0V7.97A4 4 0 0 1 4 3.999zm2.493 8.574a.5.5 0 0 1-.411.575c-.712.118-1.28.295-1.655.493a1.3 1.3 0 0 0-.37.265.3.3 0 0 0-.057.09V14l.002.008.016.033a.6.6 0 0 0 .145.15c.165.13.435.27.813.395.751.25 1.82.414 3.024.414s2.273-.163 3.024-.414c.378-.126.648-.265.813-.395a.6.6 0 0 0 .146-.15l.015-.033L12 14v-.004a.3.3 0 0 0-.057-.09 1.3 1.3 0 0 0-.37-.264c-.376-.198-.943-.375-1.655-.493a.5.5 0 1 1 .164-.986c.77.127 1.452.328 1.957.594C12.5 13 13 13.4 13 14c0 .426-.26.752-.544.977-.29.228-.68.413-1.116.558-.878.293-2.059.465-3.34.465s-2.462-.172-3.34-.465c-.436-.145-.826-.33-1.116-.558C3.26 14.752 3 14.426 3 14c0-.599.5-1 .961-1.243.505-.266 1.187-.467 1.957-.594a.5.5 0 0 1 .575.411"/>
</svg>`;

            return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
        }

        return L.Icon.Default.prototype._getIconUrl.call(this, name);
    },

    createIcon: function () {
        var div = document.createElement('div'),
            options = this.options;

        if (options.glyph) {
            div.appendChild(this._createGlyph());
        }

        this._setIconStyles(div, options.className);
        return div;
    },

    _createGlyph: function() {
        var glyphClass,
            textContent,
            options = this.options;

        if (!options.prefix) {
            glyphClass = '';
            textContent = options.glyph;
        } else if((options.prefix === "fab") || (options.prefix === "fal") || (options.prefix === "far") || (options.prefix === "fas")) {
            // Hack for Font Awesome 5 - it needs two different prefixes.
            glyphClass = "fa-" + options.glyph;
        } else if(options.glyph.slice(0, options.prefix.length+1) === options.prefix + "-") {
            glyphClass = options.glyph;
        } else {
            glyphClass = options.prefix + "-" + options.glyph;
        }

        //var span = L.DomUtil.create('span', options.prefix + ' ' + glyphClass);
        var span = L.DomUtil.create('span', options.prefix);

        if (options.prefix && options.prefix.startsWith("material-symbols")) {
            span.textContent = options.glyph;
        } else {
            L.DomUtil.addClass(span, glyphClass);
        }

        span.style.fontSize = options.glyphSize;
        span.style.color = options.glyphColor;
        span.style.width = options.iconSize[0] + 'px';
        span.style.lineHeight = options.iconSize[1] + 'px';
        span.style.textAlign = 'center';
        span.style.marginLeft = options.glyphAnchor[0] + 'px';
        span.style.marginTop = options.glyphAnchor[1] + 'px';
        span.style.pointerEvents = 'none';
        span.style.display = 'inline-block';

        if (textContent) {
            span.innerHTML = textContent;
        }

        return span;
    },

    _setIconStyles: function (div, name) {
        if (name === 'shadow') {
            return L.Icon.prototype._setIconStyles.call(this, div, name);
        }

        var options = this.options,
            size = L.point(options['iconSize']),
            anchor = L.point(options.iconAnchor);

        if (!anchor && size) {
            anchor = size.divideBy(2, true);
        }

        div.className = 'leaflet-marker-icon leaflet-glyph-icon ' + name;
        var src = this._getIconUrl('icon');
        if (src) {
            div.style.backgroundImage = "url('" + src + "')";
        }

        if (options.bgPos) {
            div.style.backgroundPosition = (-options.bgPos.x) + 'px ' + (-options.bgPos.y) + 'px';
        }
        if (options.bgSize) {
            div.style.backgroundSize = (options.bgSize.x) + 'px ' + (options.bgSize.y) + 'px';
        }

        if (anchor) {
            div.style.marginLeft = (-anchor.x) + 'px';
            div.style.marginTop  = (-anchor.y) + 'px';
        }

        if (size) {
            div.style.width  = size.x + 'px';
            div.style.height = size.y + 'px';
        }
    }
});

L.icon.glyph = function (options) {
    return new L.Icon.Glyph(options);
};


// Base64-encoded version of glyph-marker-icon.png
//L.Icon.Glyph.prototype.options.iconUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAUlSURBVFjDrZdLiBxVFIb/e289uqt6kkx6zIiIoKgLRReKuMhCcaOIAUEIiCCE4CIPggZ8kBjooPgM0TiYEUUjqBGchZqAQlyYRTA+kJiJQiJGMjN5zYzT3dP1rrr3HBeTjDGTSfc8Dvyruud89Z9z6kIJdBj31763MivsJXKuZYF6dak5++2mh7NOcsXVHq6sHbhOK/24kOJJMO4AE1vKygwZhxlKSHGKiD+RSu09vOXB43OCrHz96y6T2lsh+OmKXzFdlbLne2UopSAupBhjECcZgjDMgiiSxPhcK/nCr1sfOtcWcm/tq9uEsL4rl0vdK67pKVu2jUwTMk0wBBAzpBCQAnAtiZIlwWQwPlHPglZQAFj1Y23VwVkh92zbd59U+Kanp+p2L12mooKQ5AbcpuclS6LiKoRhxOfHzhXMcs3PtVV7Z0DufXH/LSzpSG9vr1/p6kIz0dDUrvx/IYXAsrJCkWc4e/Z0Zpgf+KX26A/TkNtrXziesY9Xq8tvWNZdVfVYg7hzwKVv3O3ZiKMWj46OTrq5fdOh1x5pSADwjdzo2nbv0u6qqkca2jCIMGcZAuqRhu8vEX7ZK2V2WgMAcXdtvyeKbPS662+osCohzMycHVweniNREoShoZO5KYobpciSh23bFq7rIUgNiLFghRkBlg2v7GlpiccsCHrcryzxUk3zmsNskeYGvt/lxVH4hMWEu9xSWaQFYQ7L1B6iGZ5bBoy+zWKiHiltFHpqeIsVhWaosg1iqlgg4wAAEYEXsV3EmNppJmExMFYUxfVSuIs6E0sI5FkBBhLJzH9laQxLSjBj0WQJgSJPweDTkknvS4JGbCuxKOt7UY4lEQfNnAu9TzLxN2nUdAQTLAEw8YIlAVgAkmDCSBL75eCutSeY+GTUqqNkqUVxUbIl4qgJo4vWzecrhyQAMJldYf1MXLLl1EIsYBZgoGwpRI2zMTPtGBhYbSQAlJF9lieRzNMIriVBzPOWawvoIkYaNC0u9IcAIAHgp75NLQl8ENbPZJ6jgAU48RyFqHEuZyE+Pda/vjENAQBD5s209Y+kPJlyM4+r3lUS0AWSyVEhpHnjYu1pyO+7N4ywwPvhxHDiuwo8j1b5rkQwMZIziYHBXetPzIAAgIV8exZOSMoieI6aU5vKtgR0jqw1JtiYbZfW/R/kSN+mcWbxdtwYjn1XTd9B7cQAfNdCWB/OhBR7jvWv/3tWCAAoO3ktjyZZJ0HHbsq2AooERVQXzPKly2vOgPz29jNNBr+e1IcSz5YAM4hmFzPDtyWS+lDK4N2DfU+dbgsBAFHyd+oszE3agt/GjWcrUBEjj5sQBb96pXpXhAzueDJi4u1p41TsuQpCiFln4bkKeXMoJeadg++tG+sYAgBBXOo3RRrruAnfkWDmGfIdCeQhiiQgQbxjtlqzQk59vCZlNluL5lDiORLyMjcA4DsKeXM4AfDKxa97ThAAqPaMfaR1Nq6jOiqOAhOm5TsKJg1QZGGRedY7V6tzVcjBWk1D0JZ8cigt2RJSimkXnqOgW8MxQLUTb6wN5g0BgGPV0c9BekTH41xx5YXrQ8FkTRgdpxU7ea9djbYQ1GokmJ43wUhWtgRcS04tQjAcw9CWw29tThYOAXD03XVfMps/TTTOy30blDZgiqxFK6p7OsnvCDJ1UD9LyUjORoPDkUQyPfdHbXW+qJCjfRsOwOAoNY4z6Xz01rHq3k5zO4ZMHTabYSIhJD87MLB64f8Ys8WdG/tfBljMJedfwY+s/2P4Pv8AAAAASUVORK5CYII=';