function wrapTextNode(textNode) {
    var spanNode = document.createElement('span');
    spanNode.setAttribute('class', 'freetext');
    var newTextNode = document.createTextNode(textNode.textContent);
    spanNode.appendChild(newTextNode);
    textNode.parentNode.replaceChild(spanNode, textNode);
}

function wrapText(node) {
    node.childNodes.forEach(lowerNode => {
        if (lowerNode.nodeType === 3) {
            let shorten = lowerNode.textContent;
            shorten = shorten.replace(/(\t|\n)/g, '');
            if (shorten.length > 0) {
                wrapTextNode(lowerNode);
            }
        } else if (lowerNode.nodeType === 1) {
            let check = (lowerNode.className !== "katex");
            check = check && (lowerNode.className !== "katex-display");
            check = check && (lowerNode.className !== "freetext");
            if (check) {
                wrapText(lowerNode);
            }
        }
    });
}

function totalWrapper() {
    [...document.getElementsByClassName("typesetting")].forEach(el => {
        wrapText(el);
    });
}
function hideElement(el) {
    el.style.visibility = "hidden";
}			function showElement(el) {
    el.style.visibility = "initial";
}
function playAnimation(element) {
    let list = [];
    hideAll();
    let counter = 0;
    let i = 0;
    typeset();

    function moveNext() {
        counter++;
        setTimeout(typeset, 100);
    }

    function typeset() {
        i = 0;
        let node;
        let content;
        let imag = new Image();
        let w;
        let h;
        let backColor = 'black';// window.getComputedStyle(node).getPropertyValue('background-color');
        let pixels;

        if (counter < list.length) {
            node = list[counter];
            showElement(node);
            if (node.className === "freetext") {
                content = node.innerHTML;
                printMoree();
            } else if (node.className === "appearImage") {
                let imgNode = node.getElementsByTagName("img")[0];
                imag.src = imgNode.src;
                w = imag.width;
                h = imag.height;
                //alert(w);
                let c = node.getElementsByTagName("canvas")[0];
                let ctx = c.getContext('2d');
                ctx.drawImage(imag, 0, 0);
                pixels = ctx.getImageData(0, 0, w, h).data;
                printImag(ctx);
            } else {
                moveNext();
            }
        }

        function printImag(ctx) {
            i++;
            let sampleSize = 1;
            if (i < 6) {
                sampleSize = 2 ** (6 - i);
                //alert(pixels);
                ctx.clearRect(0, 0, w, h);
                for (let y = 0; y < h; y += sampleSize) {
                    for (let x = 0; x < w; x += sampleSize) {
                        let p = (x + (y * w)) * 4;
                        ctx.fillStyle = "rgba(" + pixels[p] + "," + pixels[p + 1] + "," + pixels[p + 2] + "," + pixels[p + 3] + ")";
                        ctx.fillRect(x, y, sampleSize, sampleSize);
                    }
                }
                setTimeout(printImag, 100, ctx);
            } else {
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(imag, 0, 0);
                moveNext();
            }
        }

        function printMoree() {
            i++;
            let first = content.substring(0, i); //+ " ".repeat(nodeData.len - i);
            let last = content.substring(i);
            //node.innerHTML = first + '<span style="color:' + backColor + '">' + last + '</span>';
            node.innerHTML = first + '<span style="visibility: hidden">' + last + '</span>';

            if (i < content.length) {
                setTimeout(printMoree, 10);
            } else {
                node.innerHTML = content;
                moveNext();
            }
        }
    }

    function hideAll() {
        list = element.querySelectorAll(".freetext,.katex,.katex-display,.appearImage");
        for (let i = 0; i < list.length; i++) {
            hideElement(list[i]);
        }
    }
}			let lettersAnimate = true;

function matrix () {
  // Draw a semitransparent black rectangle on top of previous drawing
  ctx.fillStyle = '#0001';
  ctx.fillRect(0, 0, w, h);

  // Set color to green and font to 15pt monospace in the drawing context
  ctx.fillStyle = '#0f0';
  ctx.font = '15pt monospace';

  // for each column put a random character at the end
  ypos.forEach((y, ind) => {
    // generate a random character
    const text = String.fromCharCode(Math.random() * 128);

    // x coordinate of the column, y coordinate is already given
    const x = ind * 20;
    // render the character at (x, y)
    ctx.fillText(text, x, y);

    // randomly reset the end of the column if it's at least 100px high
    if (y > 100 + Math.random() * 10000) ypos[ind] = 0;
    // otherwise just move the y coordinate for the column 20px down,
    else ypos[ind] = y + 20;
  });
}
