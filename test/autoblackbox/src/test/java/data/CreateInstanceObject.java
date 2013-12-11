package data;

public class CreateInstanceObject {
	private String instanceName;
	private String imageVersion;
	private String imageOs;
	private String imageOsType;
	private String imageDescription;
	private String packageName;
	private String packageDisplayedName;
	private String packageDescription;
	private String price;
	private String priceMonth;
	private String dataCenter;
	private boolean inPublic;
	private boolean inPrivate;

	public String getInstanceName() {
		return instanceName;
	}

	public void setInstanceName(String instanceName) {
		this.instanceName = instanceName;
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
		return "CreateInstanceObject [instanceName=" + instanceName
				+ ", imageVersion=" + imageVersion + ", imageOs=" + imageOs
				+ ", imageDescription=" + imageDescription + ", packageName="
				+ packageName + ", packageDisplayedName="
				+ packageDisplayedName + ", packageDescription="
				+ packageDescription + ", price=" + price + ", priceMonth="
				+ priceMonth + ", dataCenter=" + dataCenter + ", inPublic="
				+ inPublic + ", inPrivate=" + inPrivate + "]";
	}

	public CreateInstanceObject(String instanceName, String imageVersion,
			String imageOs, String imageDescription, String packageName,
			String packageDisplayedName, String packageDescription,
			String price, String priceMonth, String dataCenter,
			boolean inPublic, boolean inPrivate) {
		super();
		this.instanceName = instanceName;
		this.imageVersion = imageVersion;
		this.imageOs = imageOs;
		this.imageDescription = imageDescription;
		this.packageName = packageName;
		this.packageDisplayedName = packageDisplayedName;
		this.packageDescription = packageDescription;
		this.price = price;
		this.priceMonth = priceMonth;
		this.dataCenter = dataCenter;
		this.inPublic = inPublic;
		this.inPrivate = inPrivate;
	}

	public CreateInstanceObject(String instanceName, String imageVersion,
			String imageOs, String imageOsType, String packageDisplayedName,
			String dataCenter, boolean inPublic, boolean inPrivate) {
		super();
		this.instanceName = instanceName;
		this.imageVersion = imageVersion;
		this.imageOs = imageOs;
		this.imageOsType = imageOsType;
		this.packageDisplayedName = packageDisplayedName;
		this.dataCenter = dataCenter;
		this.inPublic = inPublic;
		this.inPrivate = inPrivate;
	}

	public CreateInstanceObject(String instanceName, String imageVersion,
			String imageOs, String packageDisplayedName, String price,
			String priceMonth) {
		this.instanceName = instanceName;
		this.imageVersion = imageVersion;
		this.imageOs = imageOs;
		this.packageDisplayedName = packageDisplayedName;
		this.price = price;
		this.priceMonth = priceMonth;
	}

	public Object[] asArray() {
		return new Object[] { instanceName, imageVersion, imageOs,
				imageDescription, packageName, packageDisplayedName,
				packageDescription, price, priceMonth };
	}

	public String getPackageDisplayedName() {
		return packageDisplayedName;
	}

	public void setPackageDisplayedName(String packageDisplayedName) {
		this.packageDisplayedName = packageDisplayedName;
	}

	public String getDataCenter() {
		return dataCenter;
	}

	public void setDataCenter(String dataCenter) {
		this.dataCenter = dataCenter;
	}

	public boolean isInPublic() {
		return inPublic;
	}

	public void setInPublic(boolean inPublic) {
		this.inPublic = inPublic;
	}

	public boolean isInPrivate() {
		return inPrivate;
	}

	public void setInPrivate(boolean inPrivate) {
		this.inPrivate = inPrivate;
	}

}