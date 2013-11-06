package data;

public class CreateInstanceObject {
	private String imageName;
	private String imageVersion;
	private String imageOs;
	private String imageDescription;
	private String packageName;
	private String packageDisplayedName;
	private String packageDescription;
	private String price;
	private String priceMonth;

	public String getImageName() {
		return imageName;
	}

	public void setImageName(String imageName) {
		this.imageName = imageName;
	}

	public String getImageVersion() {
		return imageVersion;
	}

	public void setImageVersion(String imageVersion) {
		this.imageVersion = imageVersion;
	}

	public String getImageOs() {
		return imageOs;
	}

	public void setImageOs(String imageOs) {
		this.imageOs = imageOs;
	}

	public String getImageDescription() {
		return imageDescription;
	}

	public void setImageDescription(String imageDescription) {
		this.imageDescription = imageDescription;
	}

	public String getPackageName() {
		return packageName;
	}

	public void setPackageName(String packageName) {
		this.packageName = packageName;
	}

	public String getPackageDescription() {
		return packageDescription;
	}

	public void setPackageDescription(String packageDescription) {
		this.packageDescription = packageDescription;
	}

	public String getPriceMonth() {
		return priceMonth;
	}

	public void setPriceMonth(String priceMonth) {
		this.priceMonth = priceMonth.replace(",", "");
	}

	public String getPrice() {
		return price;
	}

	public void setPrice(String price) {
		this.price = price.replace(",", "");
	}

	@Override
	public String toString() {
		return "CreateInstanceObject [imageName=" + imageName
				+ ", imageVersion=" + imageVersion + ", imageOs=" + imageOs
				+ ", imageDescription=" + imageDescription + ", packageName="
				+ packageName + ", packageDescription=" + packageDescription
				+ ", price=" + price + ", priceMonth=" + priceMonth + "]";
	}

	public CreateInstanceObject(String imageName, String imageVersion,
			String imageOs, String imageDescription, String packageName,
			String packageDisplayedName, String packageDescription,
			String price, String priceMonth) {
		super();
		this.imageName = imageName;
		this.imageVersion = imageVersion;
		this.imageOs = imageOs;
		this.imageDescription = imageDescription;
		this.packageName = packageName;
		this.packageDisplayedName = packageDisplayedName;
		this.packageDescription = packageDescription;
		this.price = price.replace(",", "");
		this.priceMonth = priceMonth.replace(",", "");
	}

	public Object[] asArray() {
		return new Object[] { imageName, imageVersion, imageOs,
				imageDescription, packageName, packageDisplayedName,
				packageDescription, price, priceMonth };
	}

	public String getPackageDisplayedName() {
		return packageDisplayedName;
	}

	public void setPackageDisplayedName(String packageDisplayedName) {
		this.packageDisplayedName = packageDisplayedName;
	}

}