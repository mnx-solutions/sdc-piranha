package pageobjects;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Selenide.*;

import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;

import java.io.IOException;
import java.util.Date;

/**
 * ImageList page object. Holds methods to interact with given pages.
 */
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
        row.$(".item.row-fluid.ng-scope :nth-child(2) span span").shouldHave(text(value));
    }

    public void checkImagePublicStatus(SelenideElement row, String value) {
        getImageDetailRow(row, 3).$(".value").shouldHave(text(value));
    }

    private SelenideElement getImageDetailRow(SelenideElement row, int i) {
        return row.$(".toolbox .machine-details-info").$(".row-fluid", i);
    }

    public static void gotoImageList() {
        Common.clickNavigationLink("Compute");
        $("[href=\"#!/images\"] span", 0).click();
    }

    public static String getImageUUID(String imageName) {
        Common.addGridColumn("UUID");
        int lines = $("#grid-instances tr").$$("[data-ng-repeat=\"prop in props | orderBy:'sequence' | filter:{active:true}\"]").size();
        SelenideElement table = $("#grid-instances");
        SelenideElement row = table.$(By.xpath("//td[contains(., " + imageName + ")]/.."));
        SelenideElement cell = row.$("[data-ng-repeat=\"prop in props | orderBy:'sequence' | filter:{active:true}\"]", lines - 1);
        return cell.getText();
    }

    public static void setImageName(String imageName) {
        $("[name=\"imageName\"]").sendKeys(imageName);
    }

    public static String createTestImage() {
        Common.clickNavigationLink("Compute");
        InstancePage.gotoInstanceDetails(Common.getTestInstanceName());
        InstancePage.openImagesSection();
        Date date = new Date();
        long timestamp = date.getTime();
        String imageName = "testImage" + timestamp;
        setImageName(imageName);
        $("[data-ng-click=\"clickCreateImage()\"]").click();
        Common.clickButtonInModal("Yes");
        Common.waitForMediumLaoderDisappear();
        Common.clickButtonInModal("Ok");
        return imageName;
    }

    public static void deleteImage(String imageId) throws IOException {
        ProcessBuilder cloudApiAuth = new ProcessBuilder("ssh", "-i", System.getProperty("privateKeyPath"), "root@192.168.115.248", "curl", "-kis", "http://10.0.0.15/images/" + imageId, "-XDELETE");
        cloudApiAuth.start();
    }
}
