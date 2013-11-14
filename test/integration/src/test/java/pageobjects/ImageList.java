package pageobjects;

import org.openqa.selenium.NoSuchElementException;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;

import util.Common;
import static com.codeborne.selenide.Selenide.*;
import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.*;

public class ImageList {

	public SelenideElement getImageByName(String name, String version) {
		ElementsCollection c = $$(".item-list-container .item.row-fluid.ng-scope");
		for (SelenideElement e : c) {
			if (e.$(".machine-list-content", 0).text().equals(name)
					&& e.$(".machine-list-content", 2).text().equals(version)) {
				return e;
			}
		}
		throw new NoSuchElementException("Such element doesn't exist");
	}

	public void checkImageUuid(SelenideElement row, String value) {
		getImageDetailRow(row, 0).$(".value").shouldHave(text(value));
	}

	public void checkImageOs(SelenideElement row, String value) {
		getImageDetailRow(row, 1).$(".value").shouldHave(text(value));
	}

	public void checkImageDescription(SelenideElement row, String value) {
		getImageDetailRow(row, 2).$(".value").shouldHave(text(value));
	}

	public void checkImageDatacenter(SelenideElement row, String value) {
		getImageDetailRow(row, 3).$(".value").shouldHave(text(value));
	}

	public void checkImagePublicStatus(SelenideElement row, String value) {
		getImageDetailRow(row, 4).$(".value").shouldHave(text(value));
	}

	private SelenideElement getImageDetailRow(SelenideElement row, int i) {
		return row.$(".toolbox .machine-details-info").$(".row-fluid", i);
	}

}
