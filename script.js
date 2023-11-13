let canvas = document.querySelector(".hello_world");
let ctx = canvas.getContext("2d");
let steps = {
    "string": "aboba",
    "actions": [{ "type": "shift" },
                { "type": "shift" },
                { "type": "shift" },
                { "type": "reduce", "to": { "symbol": "<B>", "size": 2, } },
                { "type": "shift" },
                { "type": "shift" },
                { "type": "reduce", "to": { "symbol": "<A>", "size": 4, } },
                { "type": "finish", "result": 1 }]
};

function init()
{
    window.requestAnimationFrame(draw)
}

canvas.width = 800;
canvas.height = 600;

let pda = {
    string:   steps.string,
    stack:    [],
    consumed: 0,

    shift()
    {
        this.stack.push(this.string[this.consumed++]);
    },

    reduce(info)
    {
        let size = this.stack.length;
        let reduced = this.stack.splice(size - info.size, info.size);
        this.stack.push(info.symbol);
    },
};
let i = 0;
let it = steps.actions[Symbol.iterator]();

function draw()
{
    ++i;
    i %= 60;

    if (i != 0)
    {
        window.requestAnimationFrame(draw);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let step = it.next().value;
    if (step != undefined)
    {
        switch (step.type)
        {
            case "shift":
            {
                pda.shift();
            } break;
            case "reduce":
            {
                pda.reduce(step.to);
            } break;
            case "finish":
            {
            } break;
        }
    }

    ctx.font = "32px Serif";
    const string = "aboba";
    const measure = ctx.measureText(string);
    const margin = {
        x: 5,
        y: 5,
    };
    const pos = {
        x: 50 + 5 * i,
        y: 50,
    };
    const rect = {
        x: pos.x - margin.x,
        y: pos.y + measure.actualBoundingBoxDescent + margin.y,
        width:  measure.width + 2 * margin.x,
        height: measure.actualBoundingBoxDescent + measure.actualBoundingBoxAscent + 2 * margin.y,
    };

    ctx.fillText(string, pos.x, pos.y);
    ctx.strokeStyle = "rgb(255, 0, 0)";
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y);
    ctx.lineTo(rect.x, rect.y - rect.height);
    ctx.lineTo(rect.x + rect.width, rect.y - rect.height);
    ctx.lineTo(rect.x + rect.width, rect.y);
    ctx.lineTo(rect.x, rect.y);
    ctx.stroke();
    ctx.closePath();

    window.requestAnimationFrame(draw);
}

init();
