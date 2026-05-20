const http = require('http');

const blogs = [
  {
    title: 'Best Gaming Keyboards 2026',
    excerpt: 'Find out which gaming keyboards dominate the market this year.',
    content: 'Gaming keyboards have come a long way. In this article we explore...',
    category: 'Gaming',
    author: 'Tech Expert',
    tags: ['gaming', 'keyboards'],
    status: 'published'
  },
  {
    title: 'Mechanical vs Membrane Keyboards',
    excerpt: 'Understand the differences and choose the best for you.',
    content: 'When it comes to keyboards, the debate between mechanical and membrane is endless.',
    category: 'Keyboards',
    author: 'Editor',
    tags: ['comparison', 'keyboards'],
    status: 'published'
  },
  {
    title: 'Top 5 Gaming Mice Under Budget',
    excerpt: 'Get professional gaming performance without breaking the bank.',
    content: 'Budget-friendly gaming mice that pack a punch. Performance meets affordability.',
    category: 'Mice',
    author: 'Product Reviewer',
    tags: ['mice', 'budget'],
    status: 'published'
  }
];

function addBlog(blog) {
  const data = JSON.stringify(blog);
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/blogs',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    console.log('Added:', blog.title);
  });

  req.on('error', (e) => console.error('Error:', e.message));
  req.write(data);
  req.end();
}

blogs.forEach(blog => addBlog(blog));
