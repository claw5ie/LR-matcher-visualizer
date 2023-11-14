const canvas = document.querySelector('.hello_world');
const ctx = canvas.getContext('2d');

class ParseTreeNode
{
    constructor(text, bounding_box)
    {
        this.text = text;
        this.box = bounding_box;
        this.children = [];
    }
};

class Vec2
{
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
    }
};

class Box
{
    constructor(x, y, width, height)
    {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
};

class PDA
{
    constructor(string, it)
    {
        this.string = steps.string;
        this.stack = [];
        this.consumed = 0;
        this.last_pos = new Vec2(100, 100);
        this.xspacing = 50;
        this.yspacing = 70;
        this.it = it;
    }

    shift()
    {
        let text = this.string[this.consumed++];
        let node = new ParseTreeNode(text, box_from_measure(this.last_pos, ctx.measureText(text)));
        this.stack.push(node);
        this.last_pos.x += node.box.width + this.xspacing;

        return [new AnimationObject('text', 500, { text: text, box: new Vec2(node.box.x, node.box.y) })];
    }

    reduce(info)
    {
        let text = info.symbol;
        let size = this.stack.length;
        let children = this.stack.splice(size - info.size, info.size);

        let min_width = Number.MAX_VALUE;
        let max_width = Number.MIN_VALUE;
        for (let node of children)
        {
            min_width = Math.min(min_width, node.box.x);
            max_width = Math.max(max_width, node.box.x + node.box.width);
        }

        let measure = ctx.measureText(text);
        this.last_pos.x = min_width + (max_width - min_width) / 2 - measure.width / 2;
        this.last_pos.y += this.yspacing;

        let node = new ParseTreeNode(text, box_from_measure(this.last_pos, measure));
        node.children = children;
        this.stack.push(node);

        this.last_pos.x += node.box.width + this.xspacing;

        let objects = [];

        {
            objects.push(new AnimationObject('text', 500, { text: text, box: new Vec2(node.box.x, node.box.y) }));

            let mid_point0 = new Vec2(node.box.x + node.box.width / 2,
                                      node.box.y - node.box.height);
            for (let subnode of node.children)
            {
                let start = new Vec2(mid_point0.x, mid_point0.y - 10);
                let end = new Vec2(subnode.box.x + subnode.box.width / 2, subnode.box.y + 10);
                objects.push(new AnimationObject('line', 800, { start: end, end: start }));
            }
        }

        return objects;
    }

    step()
    {
        let info = this.it.next().value;

        if (info == undefined)
            return [];

        switch (info.type)
        {
            case 'shift':
            {
                return pda.shift();
            } break;
            case 'reduce':
            {
                return pda.reduce(info.to);
            } break;
            case 'finish':
            {
                return [];
            } break;
        }
    }
};

class AnimationObject
{
    constructor(type, time, data)
    {
        this.type = type;
        this.data = data;
        this.time = time;
        this.completion = 0;
    }

    draw()
    {
        switch (this.type)
        {
            case 'line':
            {
                let data = this.data;
                let dir = new Vec2((data.end.x - data.start.x) * this.completion,
                                   (data.end.y - data.start.y) * this.completion);

                ctx.fillStyle = 'rgb(0, 0, 0)';
                ctx.beginPath();
                {
                    ctx.moveTo(data.start.x, data.start.y);
                    ctx.lineTo(data.start.x + dir.x, data.start.y + dir.y);
                    ctx.stroke();
                }
                ctx.closePath();
            } break;
            case 'text':
            {
                let data = this.data;

                ctx.fillStyle = 'rgb(0, 0, 0)';
                ctx.fillText(data.text, data.box.x, data.box.y);
            } break;
        }
    }
};

function box_from_measure(pos, measure)
{
    let height = measure.actualBoundingBoxDescent + measure.actualBoundingBoxAscent;
    return new Box(pos.x, pos.y, measure.width, height);
}

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

let pda = new PDA(steps.string, steps.actions[Symbol.iterator]());

let last_time = 0;
let dt = 0;

let animation_objects = [];
let finished_objects = [];

function init()
{
    canvas.width = 1920;
    canvas.height = 1080;
    ctx.font = '32px Iosevka ss12';

    window.requestAnimationFrame(draw);
}

function clear_canvas(current_time)
{
    dt = current_time - last_time;
    last_time = current_time;

    {
        let old_style = ctx.fillStyle;
        ctx.fillStyle = 'rgb(190, 190, 190)';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.fill();
        ctx.closePath();
        ctx.fillStyle = old_style;
    }
}

function draw(current_time)
{
    clear_canvas(current_time);

    for (let obj of finished_objects)
        obj.draw();

    if (animation_objects.length > 0)
    {
        let all_done = true;

        for (let obj of animation_objects)
        {
            obj.completion += dt / obj.time;
            obj.completion = Math.min(obj.completion, 1);
            obj.draw();
            all_done = (obj.completion >= 1) && all_done;
        }

        if (all_done)
        {
            finished_objects.push.apply(finished_objects, animation_objects);
            animation_objects = [];
        }
    }
    else
    {
        animation_objects = pda.step();
    }

    window.requestAnimationFrame(draw);
}

init();
