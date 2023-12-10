export class Vec2
{
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
    }

    copy()
    {
        return new Vec2(this.x, this.y);
    }

    normalize()
    {
        let dist = abs_v2(this, 0);
        this.x /= dist;
        this.y /= dist;
    }
};

export function abs_v2(v, fallback)
{
    let x = Math.abs(v.x);
    let y = Math.abs(v.y);
    let m = Math.max(x, y);
    if (m < 1e-8)
        return fallback;

    x /= m;
    y /= m;
    x *= x;
    y *= y;
    return m * Math.sqrt(x + y);
}

export function cross_v2(u, v)
{
    return u.x * v.y - u.y * v.x;
}

export function dot_v2(u, v)
{
    return u.x * v.x + u.y * v.y;
}
