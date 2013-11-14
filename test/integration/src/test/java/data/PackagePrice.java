package data;

public class PackagePrice {
	private String name;
	private String price;
	private String priceMonth;
	private String short_name;

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getPrice() {
		return price;
	}

	public void setPrice(String price) {
		this.price = price;
	}

	public String getPriceMonth() {
		return priceMonth;
	}

	public void setPriceMonth(String priceMonth) {
		this.priceMonth = priceMonth;
	}

	@Override
	public String toString() {
		return "PackagePrice [name=" + name + ", price=" + price
				+ ", priceMonth=" + priceMonth + "]";
	}

	public PackagePrice(String name, String price, String priceMonth,
			String short_name) {
		super();
		this.name = name;
		this.price = price;
		this.priceMonth = priceMonth;
		this.short_name = short_name;
	}

	public String getShort_name() {
		return short_name;
	}

	public void setShort_name(String short_name) {
		this.short_name = short_name;
	}

}
