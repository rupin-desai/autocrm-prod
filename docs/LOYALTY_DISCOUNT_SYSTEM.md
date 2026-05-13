# Customer Loyalty Discount System

## Overview
The AutoParts Pro system now includes an **automatic loyalty discount program** that rewards customers based on their visit frequency and spending. The system automatically tracks customer visits and applies discounts on future purchases.

## How It Works

### Loyalty Tiers

Customers are automatically assigned to loyalty tiers based on their total number of completed service visits:

| Tier | Visits Required | Discount | Loyalty Points |
|------|----------------|----------|----------------|
| **Bronze** | 0-4 visits | 0% | 10 points per visit |
| **Silver** | 5-9 visits | 5% | 10 points per visit |
| **Gold** | 10-19 visits | 10% | 10 points per visit |
| **Platinum** | 20+ visits | 15% | 10 points per visit |

### Automatic Tracking

The system automatically tracks:
- ✅ **Visit Count**: Incremented when service visit status changes to "completed"
- ✅ **Total Spent**: Sum of all completed service visits and orders
- ✅ **Loyalty Points**: Calculated as visit count × 10
- ✅ **Tier Upgrades**: Automatic tier calculation and update
- ✅ **Discount Application**: Automatically applied to new orders

## Features

### 1. Automatic Visit Tracking
When a service visit is marked as "completed":
- Customer's visit count is incremented by 1
- Total spent is updated with the service visit amount
- Loyalty tier is recalculated
- Discount percentage is updated based on new tier

### 2. Automatic Order Discounts
When creating an order for a registered customer:
- System checks customer's loyalty tier
- If discount available (Silver, Gold, or Platinum):
  - Discount amount calculated: `(order total × discount %) / 100`
  - Discount is applied to order
  - Final total is reduced by discount amount
- Walk-in customers don't receive discounts

### 3. Digital Customer Card Display

The loyalty information is beautifully displayed on the customer card with:

#### Visual Loyalty Card
- **Tier Badge**: Color-coded based on tier (Bronze/Silver/Gold/Platinum)
- **Discount Badge**: Shows active discount percentage
- **Points Display**: Current loyalty points earned
- **Total Spent**: Total amount spent by customer
- **Visit Count**: Total completed service visits

#### Color Coding
- **Platinum**: Gradient from slate-400 to slate-600 (Silver-gray)
- **Gold**: Gradient from yellow-400 to yellow-600
- **Silver**: Gradient from gray-300 to gray-500
- **Bronze**: Gradient from orange-400 to orange-600

### 4. Customer List View
Customers with active discounts (Silver/Gold/Platinum) show:
- Loyalty tier badge with discount percentage
- Example: "Gold • 10% OFF"
- Only displayed for non-Bronze tiers

## Backend Implementation

### Customer Model Updates
```typescript
{
  loyaltyPoints: Number (default: 0)
  totalSpent: Number (default: 0)
  visitCount: Number (default: 0)
  loyaltyTier: String ['Bronze', 'Silver', 'Gold', 'Platinum'] (default: 'Bronze')
  discountPercentage: Number (default: 0)
}
```

### Loyalty Tier Calculation Method
```typescript
calculateLoyaltyTier() {
  if (visitCount >= 20) -> Platinum (15% discount)
  else if (visitCount >= 10) -> Gold (10% discount)
  else if (visitCount >= 5) -> Silver (5% discount)
  else -> Bronze (0% discount)
  
  loyaltyPoints = visitCount × 10
}
```

### Service Visit Completion Logic
When a service visit status changes to "completed":
1. Find customer by ID
2. Increment visit count by 1
3. Add service visit total to customer's total spent
4. Recalculate loyalty tier and discount
5. Save updated customer record

### Order Creation with Discount
When creating an order for a registered customer:
1. Check if customer has active discount
2. Calculate discount amount from original total
3. Create order with discount field populated
4. Reduce final total by discount amount
5. Update customer's total spent (after discount applied)

### Order Model Updates
```typescript
{
  discount: Number (default: 0) // Amount discounted from order
}
```

## Frontend Implementation

### DigitalCustomerCard Component
Displays comprehensive loyalty information:
- Tier badge with gradient colors
- Current discount percentage
- Loyalty points earned
- Total amount spent
- Visit count
- Congratulatory message for active discounts

### Customer List View
Shows loyalty badges for qualifying customers:
- Badge only shown for Silver/Gold/Platinum tiers
- Format: "{Tier} • {Discount}% OFF"
- Helps identify valuable customers at a glance

## API Endpoints

### Service Visit Completion
```
PATCH /api/service-visits/:id
Body: { status: "completed", ... }
```
Triggers loyalty update when status changes to "completed"

### Order Creation with Discount
```
POST /api/orders
Body: { customerId, items, total, ... }
```
Automatically applies customer's loyalty discount if applicable

### Customer Data Retrieval
```
GET /api/customers
GET /api/customers/:id
```
Returns customer data including loyalty fields

## Usage Examples

### Example 1: New Customer Journey
1. **Visit 1-4**: Customer is Bronze tier (0% discount)
2. **Visit 5**: Automatically upgraded to Silver (5% discount)
3. **Next order**: 5% discount automatically applied
4. **Visit 10**: Upgraded to Gold (10% discount)
5. **Visit 20**: Upgraded to Platinum (15% discount)

### Example 2: Discount Application
**Customer**: Gold tier (10% discount)
**Order Total**: ₹10,000

Calculation:
- Discount: ₹10,000 × 10% = ₹1,000
- Final Total: ₹10,000 - ₹1,000 = ₹9,000
- Order saved with discount: ₹1,000

### Example 3: Points Accumulation
**Customer**: 15 completed visits
- Loyalty Points: 15 × 10 = 150 points
- Tier: Gold (10% discount)
- Points continue to accumulate with each visit

## Business Benefits

### Customer Retention
- Encourages repeat visits
- Rewards loyal customers automatically
- Visible tier progression motivates continued patronage

### Automated Management
- No manual discount codes needed
- Automatic tier upgrades
- Real-time discount application

### Revenue Insights
- Track total customer lifetime value
- Identify most valuable customers
- Monitor loyalty program effectiveness

## Testing the System

### Test Scenario 1: Service Visit Completion
1. Login as Admin or Service Staff
2. Create a service visit for a customer
3. Update visit status to "completed"
4. Check customer card - visit count should increment
5. If customer reaches tier threshold, tier should upgrade

### Test Scenario 2: Order with Discount
1. Login as Admin or Sales Executive
2. Create order for customer with active discount (Silver/Gold/Platinum)
3. System automatically applies discount
4. Verify final total is reduced
5. Check order details - discount field should be populated

### Test Scenario 3: View Customer Loyalty
1. Navigate to Customers page
2. Click on any customer card
3. View digital customer card
4. Check loyalty tier, discount, and points display
5. Verify color-coded tier badge

## Future Enhancements (Potential)

- Point redemption system
- Birthday/anniversary bonus points
- Referral rewards
- Tier expiration based on inactivity
- Special promotions for tier members
- Email notifications for tier upgrades
- Printable loyalty cards with QR codes

## Summary

The loyalty discount system is **fully automated and integrated** into the AutoParts Pro application. Customers are automatically tracked, tiered, and rewarded based on their visit frequency. Discounts are automatically applied to orders, and the entire system requires no manual intervention from staff.

**Key Features:**
✅ Automatic tier assignment based on visits
✅ Real-time discount application on orders
✅ Beautiful visual loyalty cards
✅ Points and spending tracking
✅ No manual discount codes needed
✅ Seamless integration with existing workflows
