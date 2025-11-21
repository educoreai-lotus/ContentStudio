export function generateDevLabFallback(skills) {
  if (!Array.isArray(skills) || skills.length === 0) {
    return { devlab_exercises: [] };
  }

  const skillsLower = skills.map(s => String(s).toLowerCase().trim());

  let language = 'html';
  let exercises = [];

  if (skillsLower.some(s => s === 'javascript' || s === 'js' || s === 'typescript' || s === 'ts')) {
    language = 'javascript';
    exercises = [
      `function calculateSum(a, b) {
  return a + b;
}

console.log(calculateSum(5, 3));`,
      `const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log(doubled);`,
      `async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}`,
      `class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
  
  greet() {
    return \`Hello, I'm \${this.name} and I'm \${this.age} years old.\`;
  }
}`
    ];
  } else if (skillsLower.some(s => s === 'python' || s === 'py')) {
    language = 'python';
    exercises = [
      `def calculate_sum(a, b):
    return a + b

result = calculate_sum(5, 3)
print(result)`,
      `numbers = [1, 2, 3, 4, 5]
doubled = [n * 2 for n in numbers]
print(doubled)`,
      `def fetch_data(url):
    import requests
    try:
        response = requests.get(url)
        return response.json()
    except Exception as e:
        print(f"Error: {e}")`,
      `class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age
    
    def greet(self):
        return f"Hello, I'm {self.name} and I'm {self.age} years old."`
    ];
  } else if (skillsLower.some(s => s === 'java')) {
    language = 'java';
    exercises = [
      `public class Calculator {
    public static int calculateSum(int a, int b) {
        return a + b;
    }
    
    public static void main(String[] args) {
        System.out.println(calculateSum(5, 3));
    }
}`,
      `import java.util.Arrays;
import java.util.stream.IntStream;

public class ArrayExample {
    public static void main(String[] args) {
        int[] numbers = {1, 2, 3, 4, 5};
        int[] doubled = Arrays.stream(numbers)
            .map(n -> n * 2)
            .toArray();
        System.out.println(Arrays.toString(doubled));
    }
}`,
      `public class Person {
    private String name;
    private int age;
    
    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }
    
    public String greet() {
        return "Hello, I'm " + name + " and I'm " + age + " years old.";
    }
}`,
      `import java.util.List;
import java.util.ArrayList;

public class ListExample {
    public static void main(String[] args) {
        List<String> items = new ArrayList<>();
        items.add("item1");
        items.add("item2");
        items.forEach(System.out::println);
    }
}`
    ];
  } else if (skillsLower.some(s => s === 'csharp' || s === 'c#')) {
    language = 'csharp';
    exercises = [
      `using System;

public class Calculator {
    public static int CalculateSum(int a, int b) {
        return a + b;
    }
    
    public static void Main() {
        Console.WriteLine(CalculateSum(5, 3));
    }
}`,
      `using System;
using System.Linq;

public class ArrayExample {
    public static void Main() {
        int[] numbers = {1, 2, 3, 4, 5};
        int[] doubled = numbers.Select(n => n * 2).ToArray();
        Console.WriteLine(string.Join(", ", doubled));
    }
}`,
      `using System;

public class Person {
    private string name;
    private int age;
    
    public Person(string name, int age) {
        this.name = name;
        this.age = age;
    }
    
    public string Greet() {
        return $"Hello, I'm {name} and I'm {age} years old.";
    }
}`,
      `using System.Collections.Generic;
using System.Linq;

public class ListExample {
    public static void Main() {
        var items = new List<string> {"item1", "item2"};
        items.ForEach(Console.WriteLine);
    }
}`
    ];
  } else if (skillsLower.some(s => s === 'php')) {
    language = 'php';
    exercises = [
      `<?php
function calculateSum($a, $b) {
    return $a + $b;
}

echo calculateSum(5, 3);`,
      `<?php
$numbers = [1, 2, 3, 4, 5];
$doubled = array_map(function($n) {
    return $n * 2;
}, $numbers);
print_r($doubled);`,
      `<?php
class Person {
    private $name;
    private $age;
    
    public function __construct($name, $age) {
        $this->name = $name;
        $this->age = $age;
    }
    
    public function greet() {
        return "Hello, I'm {$this->name} and I'm {$this->age} years old.";
    }
}`,
      `<?php
$data = ['item1', 'item2', 'item3'];
foreach ($data as $item) {
    echo $item . PHP_EOL;
}`
    ];
  } else if (skillsLower.some(s => s === 'html' || s === 'css')) {
    language = 'html';
    exercises = [
      `<html>
<head>
    <title>My Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome</h1>
        <p>This is a sample page.</p>
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Page loaded');
        });
    </script>
</body>
</html>`,
      `<div class="card">
    <h2>Card Title</h2>
    <p>Card content goes here.</p>
    <button onclick="handleClick()">Click Me</button>
</div>

<style>
.card {
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 20px;
    margin: 10px;
}
</style>

<script>
function handleClick() {
    alert('Button clicked!');
}
</script>`,
      `<form id="myForm">
    <input type="text" id="name" placeholder="Enter name" required>
    <input type="email" id="email" placeholder="Enter email" required>
    <button type="submit">Submit</button>
</form>

<script>
document.getElementById('myForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    console.log('Name:', name, 'Email:', email);
});
</script>`,
      `<nav>
    <ul>
        <li><a href="#home">Home</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#contact">Contact</a></li>
    </ul>
</nav>

<style>
nav ul {
    list-style: none;
    display: flex;
    gap: 20px;
}
nav a {
    text-decoration: none;
    color: #333;
}
</style>`
    ];
  } else {
    language = 'html';
    exercises = [
      `<html>
<head>
    <title>Sample Page</title>
</head>
<body>
    <h1>Hello World</h1>
    <p>This is a sample HTML page.</p>
</body>
</html>`,
      `<div class="container">
    <header>
        <h1>Header</h1>
    </header>
    <main>
        <p>Main content area</p>
    </main>
    <footer>
        <p>Footer</p>
    </footer>
</div>`,
      `<form>
    <label>Name: <input type="text" name="name"></label>
    <label>Email: <input type="email" name="email"></label>
    <button type="submit">Submit</button>
</form>`,
      `<table>
    <tr>
        <th>Column 1</th>
        <th>Column 2</th>
    </tr>
    <tr>
        <td>Data 1</td>
        <td>Data 2</td>
    </tr>
</table>`
    ];
  }

  return {
    devlab_exercises: exercises
  };
}

