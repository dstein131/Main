// scripts/seedServices.js

const pool = require('../pool/pool'); // Adjust the path as necessary
const userpool = require('../pool/userpool'); // Adjust the path as necessary

// Define the servicesData as per Services.jsx
const servicesData = [
    {
        sectionTitle: 'Pricing Packages',
        packages: [
            {
                title: 'Basic Package',
                price: 500.00,
                description: 'Up to 3 pages (Home, About, Contact), Professional template with light customization, Basic mobile responsiveness, Integration of a contact form, Delivery Time: 1 week',
                addons: [
                    { name: 'Additional Pages: $100/page', price: 100.00, description: 'Add additional pages beyond the basic package.' },
                    { name: 'Hosting Setup: $50', price: 50.00, description: 'Setup hosting for your website.' }
                ]
            },
            {
                title: 'Standard Package',
                price: 1500.00,
                description: 'Up to 5 custom-designed pages, Fully responsive design (desktop, tablet, mobile), Custom CSS animations and interactive elements, Basic SEO optimization (meta tags, alt attributes), Delivery Time: 2–3 weeks',
                addons: [
                    { name: 'Blog or Portfolio Section: $200', price: 200.00, description: 'Add a blog or portfolio section to your website.' },
                    { name: 'Hosting & Domain Setup: $50', price: 50.00, description: 'Setup hosting and domain for your website.' }
                ]
            },
            {
                title: 'Premium Package',
                price: 3000.00,
                description: 'Up to 10 custom pages with advanced layouts and features, High-quality, custom graphics or image editing, Integration with third-party tools (e.g., MailChimp, Google Analytics), Enhanced SEO optimization, Accessibility Features (WCAG compliance), Delivery Time: 3–4 weeks',
                addons: [
                    { name: 'E-commerce Features: $500+', price: 500.00, description: 'Add e-commerce capabilities to your website.' },
                    { name: 'Content Creation: $200–$400', price: 300.00, description: 'Create content such as copywriting, images, etc.' }
                ]
            }
        ]
    },
    {
        sectionTitle: 'Advanced Static Website Packages',
        packages: [
            {
                title: 'Tier 1: Intermediate Advanced Site',
                price: 3000.00,
                description: 'Up to 10 pages with advanced layouts and interactive elements (e.g., galleries, modals), Custom graphics and CSS animations, Integration with external tools (e.g., Google Analytics, email marketing platforms), Fully responsive design (desktop, tablet, mobile), Basic SEO optimization, Social media integration (e.g., share buttons, feeds), Delivery Time: 3–4 weeks',
                addons: [] // No add-ons
            },
            {
                title: 'Tier 2: Full Advanced Static Site',
                price: 5000.00,
                description: 'Up to 15 custom-designed pages, Advanced features such as search functionality, video embedding, advanced animations or parallax effects, Enhanced SEO optimization for better ranking potential, Website Accessibility (WCAG compliance for ADA standards), Delivery Time: 4–6 weeks',
                addons: [
                    { name: 'E-commerce Features (Product Listings, Static Cart): $500–$2,000', price: 500.00, description: 'Add product listings and a static cart to your site.' },
                    { name: 'API Integrations (e.g., weather data, stock market feeds): $300–$800+', price: 300.00, description: 'Integrate external APIs into your site.' },
                    { name: 'Membership Pages (Password-Protected): $200–$500', price: 200.00, description: 'Create password-protected membership pages.' },
                    { name: 'Content Creation (Copy, Stock Images, Blog Posts): $300–$1,000', price: 300.00, description: 'Create content such as copywriting and images.' }
                ]
            }
        ]
    },
    {
        sectionTitle: 'Hosting, Deployment, and Monthly Maintenance',
        packages: [
            {
                title: 'Hosting & Domain Setup',
                price: null,
                description: 'Basic Setup: $50 (one-time), Assistance with hosting platforms like GitHub Pages, Netlify, or Vercel, Managed Hosting (Optional): $20/month + hosting fees',
                addons: [] // No add-ons
            },
            {
                title: 'Monthly Maintenance Plans',
                price: null,
                description: 'Basic Maintenance - $100/month: Monitoring uptime and basic functionality, Minor updates to existing content (text, images, links), Monthly backups; Standard Maintenance - $250/month: Everything in Basic Plan, Adding or modifying small features (e.g., a new section or page updates), Regular SEO audits and updates to improve search rankings, Security checks and fixes; Premium Maintenance - $500/month: Everything in Standard Plan, Adding custom features (e.g., new galleries or forms), Priority support (faster response times), Advanced analytics and performance optimization',
                addons: [] // No add-ons
            },
            {
                title: 'Add-On Monthly Services',
                price: null,
                description: 'Content Creation (e.g., blog posts, image galleries): $50–$200 per post, SEO Optimization: $100/month for ongoing keyword updates and reporting, Third-Party Tool Management (e.g., Mailchimp, Analytics): $50–$100/month',
                addons: [] // No add-ons
            }
        ]
    }
];

const seedServices = async () => {
    try {
        for (const section of servicesData) {
            for (const pkg of section.packages) {
                // Insert into services table
                const [serviceResult] = await pool.query(
                    'INSERT INTO services (title, price, description) VALUES (?, ?, ?)',
                    [pkg.title, pkg.price, pkg.description]
                );
                const serviceId = serviceResult.insertId;
                console.log(`Inserted service: ${pkg.title} with ID: ${serviceId}`);

                // Insert add-ons if any
                if (pkg.addons && pkg.addons.length > 0) {
                    for (const addon of pkg.addons) {
                        const [addonResult] = await pool.query(
                            'INSERT INTO service_addons (service_id, name, price, description) VALUES (?, ?, ?, ?)',
                            [serviceId, addon.name, addon.price, addon.description]
                        );
                        const addonId = addonResult.insertId;
                        console.log(`  Inserted add-on: ${addon.name} with ID: ${addonId}`);
                    }
                }
            }
        }
        console.log('All services and add-ons have been inserted successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding services:', err);
        process.exit(1);
    }
};

// Execute the seed function
seedServices();
